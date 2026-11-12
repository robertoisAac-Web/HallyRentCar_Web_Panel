-- Fase 6: Módulo de Facturación, Recibos de Pago y preparación fiscal DGII (NCF / e-CF)

-- ---------- tabla de facturas (invoices) ----------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  code text not null,
  reservation_id uuid,
  customer_id uuid not null,
  vehicle_id uuid,
  source text not null default 'manual' check (source in ('reservation', 'manual')),
  issue_date date not null default ((now() at time zone 'America/Santo_Domingo')::date),
  due_date date not null default (((now() at time zone 'America/Santo_Domingo')::date) + 7),
  currency text not null default 'DOP' check (currency in ('DOP', 'USD')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  -- Preparación fiscal DGII (República Dominicana)
  document_scope text not null default 'internal' check (document_scope in ('internal', 'fiscal_ncf', 'fiscal_ecf')),
  fiscal_type text not null default 'none' check (fiscal_type in ('none', 'B01', 'B02', 'B14', 'B15', 'E31', 'E32', 'E44', 'E45')),
  ncf_or_ecf text,
  ncf_expiration_date date,
  security_code text,
  dgii_status text not null default 'not_applicable' check (dgii_status in ('not_applicable', 'pending_integration', 'issued', 'voided')),
  customer_tax_id text,
  customer_tax_name text,
  notes text,
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, code),
  foreign key (company_id, customer_id) references public.customers (company_id, id) on delete restrict,
  foreign key (company_id, reservation_id) references public.reservations (company_id, id) on delete restrict,
  foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  check (due_date >= issue_date),
  check (total_amount = round(greatest(subtotal - discount_amount, 0) + tax_amount, 2))
);

create index if not exists invoices_company_issue_idx on public.invoices (company_id, issue_date desc);
create index if not exists invoices_customer_idx on public.invoices (company_id, customer_id);
create index if not exists invoices_reservation_idx on public.invoices (reservation_id);

create or replace function app.invoices_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare yr text;
begin
  if tg_op = 'INSERT' and (new.code is null or new.code = '') then
    yr := to_char(now() at time zone 'America/Santo_Domingo', 'YYYY');
    new.code := 'FAC-' || yr || '-' || lpad(app.next_sequence(new.company_id, 'invoice-' || yr)::text, 4, '0');
  end if;
  -- Mientras no exista NCF/e-CF autorizado asignado, el documento se mantiene como factura interna
  if new.ncf_or_ecf is null or length(trim(new.ncf_or_ecf)) = 0 then
    new.ncf_or_ecf := null;
    new.document_scope := 'internal';
    if new.fiscal_type <> 'none' then
      new.dgii_status := 'pending_integration';
    else
      new.dgii_status := 'not_applicable';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_invoices_before on public.invoices;
create trigger trg_invoices_before before insert or update on public.invoices
  for each row execute function app.invoices_before_write();

drop trigger if exists trg_invoices_updated on public.invoices;
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function app.set_updated_at();

drop trigger if exists trg_audit_invoices on public.invoices;
create trigger trg_audit_invoices after insert or update or delete on public.invoices
  for each row execute function app.audit_row();

-- ---------- renglones de factura (invoice_items) ----------
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  invoice_id uuid not null,
  item_type text not null default 'rental' check (item_type in ('rental', 'extra', 'service', 'other')),
  description text not null check (length(trim(description)) > 0),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2) not null default 0 check (line_total >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (company_id, invoice_id) references public.invoices (company_id, id) on delete cascade,
  check (line_total = round(quantity * unit_price, 2))
);

create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id, sort_order);

-- ---------- extender payments para vincular a facturas y generar recibos ----------
alter table public.payments alter column reservation_id drop not null;
alter table public.payments add column if not exists invoice_id uuid;
alter table public.payments add column if not exists receipt_number text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_company_invoice_fkey'
  ) then
    alter table public.payments
      add constraint payments_company_invoice_fkey
      foreign key (company_id, invoice_id) references public.invoices (company_id, id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payments_target_chk'
  ) then
    alter table public.payments
      add constraint payments_target_chk
      check (reservation_id is not null or invoice_id is not null);
  end if;
end $$;

create index if not exists payments_invoice_idx on public.payments (invoice_id);

-- Actualizar trigger de validación de moneda y generación automática de número de recibo (REC-YYYY-0001)
create or replace function app.money_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cur text; yr text;
begin
  if tg_table_name = 'payments' then
    if new.receipt_number is null or length(trim(new.receipt_number)) = 0 then
      yr := to_char(now() at time zone 'America/Santo_Domingo', 'YYYY');
      new.receipt_number := 'REC-' || yr || '-' || lpad(app.next_sequence(new.company_id, 'receipt-' || yr)::text, 4, '0');
    end if;
  end if;

  if new.reservation_id is not null then
    select currency into cur from public.reservations where id = new.reservation_id for update;
    if cur is null then raise exception 'Reserva no encontrada'; end if;
    if cur <> new.currency then
      raise exception 'La moneda (%) no coincide con la de la reserva (%)', new.currency, cur using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'payments' and new.invoice_id is not null then
    select currency into cur from public.invoices where id = new.invoice_id for update;
    if cur is null then raise exception 'Factura no encontrada'; end if;
    if cur <> new.currency then
      raise exception 'La moneda (%) no coincide con la de la factura (%)', new.currency, cur using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create or replace function app.payments_check_net() returns trigger
language plpgsql security definer set search_path = '' as $$
declare net numeric;
begin
  if new.reservation_id is not null then
    perform 1 from public.reservations where id = new.reservation_id for update;
    select coalesce(sum(case when kind = 'refund' then -amount else amount end), 0) into net
    from public.payments where reservation_id = new.reservation_id and voided_at is null;
    if net < 0 then
      raise exception 'El reembolso supera lo cobrado en esta reserva' using errcode = 'check_violation';
    end if;
  elsif new.invoice_id is not null then
    perform 1 from public.invoices where id = new.invoice_id for update;
    select coalesce(sum(case when kind = 'refund' then -amount else amount end), 0) into net
    from public.payments where invoice_id = new.invoice_id and voided_at is null;
    if net < 0 then
      raise exception 'El reembolso supera lo cobrado en esta factura' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

-- ---------- RLS para invoices e invoice_items ----------
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select to authenticated
  using (app.has_permission(company_id, 'payments:read'));

drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert to authenticated
  with check (app.has_permission(company_id, 'payments:write'));

drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices for update to authenticated
  using (app.has_permission(company_id, 'payments:write') or app.has_permission(company_id, 'payments:void'))
  with check (app.has_permission(company_id, 'payments:write') or app.has_permission(company_id, 'payments:void'));

drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items for select to authenticated
  using (app.has_permission(company_id, 'payments:read'));

drop policy if exists invoice_items_insert on public.invoice_items;
create policy invoice_items_insert on public.invoice_items for insert to authenticated
  with check (app.has_permission(company_id, 'payments:write'));

drop policy if exists invoice_items_delete on public.invoice_items;
create policy invoice_items_delete on public.invoice_items for delete to authenticated
  using (app.has_permission(company_id, 'payments:write'));

revoke delete on public.invoices from authenticated;
revoke all on public.invoices, public.invoice_items from anon;

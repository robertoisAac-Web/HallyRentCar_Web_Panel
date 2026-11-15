-- Fase 7: Control de Caja (Turnos y Arqueo Diario), Cuentas Bancarias Receptoras,
-- Pagos Mixtos, Trazabilidad Contrato <-> Factura y Arquitectura e-CF DGII (XML / Firma / TrackId).

-- ---------- 1. Cuentas Bancarias Receptoras (bank_accounts) ----------
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_name text not null check (length(trim(bank_name)) > 0),
  account_label text not null check (length(trim(account_label)) > 0),
  account_number_masked text,
  currency text not null default 'DOP' check (currency in ('DOP', 'USD')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, id)
);

create index if not exists bank_accounts_company_idx on public.bank_accounts (company_id) where is_active;

-- Sembrar bancos principales de República Dominicana por defecto para las empresas existentes
insert into public.bank_accounts (company_id, bank_name, account_label, account_number_masked, currency)
select c.id, b.bank_name, b.account_label, b.account_number_masked, b.currency
from public.companies c
cross join (values
  ('Banreservas', 'Banreservas · Cuenta Operativa DOP', 'DOP-Principal', 'DOP'),
  ('Banco Popular Dominicano', 'Banco Popular · Cuenta Operativa DOP', 'DOP-Popular', 'DOP'),
  ('Banco BHD', 'Banco BHD · Cuenta Operativa DOP', 'DOP-BHD', 'DOP'),
  ('Banreservas', 'Banreservas · Cuenta en Dólares USD', 'USD-Reservas', 'USD')
) as b(bank_name, account_label, account_number_masked, currency)
where not exists (
  select 1 from public.bank_accounts ba where ba.company_id = c.id and ba.bank_name = b.bank_name and ba.currency = b.currency
);

-- ---------- 2. Turnos de Caja y Arqueo Diario (cash_shifts) ----------
create table if not exists public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  code text not null,
  cashier_user_id uuid not null references auth.users(id),
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  opening_amount_dop numeric(12,2) not null default 0 check (opening_amount_dop >= 0),
  opening_amount_usd numeric(12,2) not null default 0 check (opening_amount_usd >= 0),
  expected_cash_dop numeric(12,2) not null default 0,
  expected_cash_usd numeric(12,2) not null default 0,
  counted_cash_dop numeric(12,2),
  counted_cash_usd numeric(12,2),
  difference_dop numeric(12,2),
  difference_usd numeric(12,2),
  notes text,
  closing_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, code)
);

create unique index if not exists cash_shifts_one_open_per_user_idx
  on public.cash_shifts (company_id, cashier_user_id)
  where (status = 'open');

create index if not exists cash_shifts_company_opened_idx
  on public.cash_shifts (company_id, opened_at desc);

create or replace function app.cash_shifts_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare yr text;
begin
  if tg_op = 'INSERT' and (new.code is null or new.code = '') then
    yr := to_char(now() at time zone 'America/Santo_Domingo', 'YYYY');
    new.code := 'CAJ-' || yr || '-' || lpad(app.next_sequence(new.company_id, 'cash-shift-' || yr)::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_cash_shifts_before on public.cash_shifts;
create trigger trg_cash_shifts_before before insert or update on public.cash_shifts
  for each row execute function app.cash_shifts_before_write();

drop trigger if exists trg_cash_shifts_updated on public.cash_shifts;
create trigger trg_cash_shifts_updated before update on public.cash_shifts
  for each row execute function app.set_updated_at();

drop trigger if exists trg_audit_cash_shifts on public.cash_shifts;
create trigger trg_audit_cash_shifts after insert or update or delete on public.cash_shifts
  for each row execute function app.audit_row();

-- ---------- 3. Extender payments para Pagos Mixtos, Caja y Conciliación Bancaria ----------
alter table public.payments add column if not exists cash_shift_id uuid;
alter table public.payments add column if not exists bank_account_id uuid;
alter table public.payments add column if not exists bank_name text;
alter table public.payments add column if not exists payment_group_id uuid;
alter table public.payments add column if not exists reconciled_at timestamptz;
alter table public.payments add column if not exists reconciled_by uuid references auth.users(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_cash_shift_fkey') then
    alter table public.payments
      add constraint payments_cash_shift_fkey
      foreign key (company_id, cash_shift_id) references public.cash_shifts (company_id, id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'payments_bank_account_fkey') then
    alter table public.payments
      add constraint payments_bank_account_fkey
      foreign key (company_id, bank_account_id) references public.bank_accounts (company_id, id) on delete restrict;
  end if;
end $$;

create index if not exists payments_cash_shift_idx on public.payments (cash_shift_id);
create index if not exists payments_group_idx on public.payments (payment_group_id);
create index if not exists payments_bank_reconcile_idx on public.payments (company_id, method, reconciled_at);

-- Trigger mejorado en payments:
-- 1) Genera número de recibo REC-YYYY-XXXX.
-- 2) Si es efectivo (method = 'cash') y no trae cash_shift_id, lo asocia automáticamente al turno abierto del cajero o de la empresa.
-- 3) Si es transferencia (method = 'transfer') y trae bank_account_id sin bank_name, copia el bank_name de bank_accounts.
create or replace function app.money_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cur text; yr text; v_shift uuid; v_bname text;
begin
  if tg_table_name = 'payments' then
    if new.receipt_number is null or length(trim(new.receipt_number)) = 0 then
      yr := to_char(now() at time zone 'America/Santo_Domingo', 'YYYY');
      new.receipt_number := 'REC-' || yr || '-' || lpad(app.next_sequence(new.company_id, 'receipt-' || yr)::text, 4, '0');
    end if;

    if new.method = 'cash' and new.cash_shift_id is null then
      select id into v_shift from public.cash_shifts
       where company_id = new.company_id and status = 'open'
       order by (cashier_user_id = auth.uid()) desc, opened_at desc
       limit 1;
      new.cash_shift_id := v_shift;
    end if;

    if new.bank_account_id is not null and (new.bank_name is null or length(trim(new.bank_name)) = 0) then
      select bank_name into v_bname from public.bank_accounts where id = new.bank_account_id;
      new.bank_name := v_bname;
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

-- ---------- 4. Arquitectura de Comprobantes Fiscales Electrónicos DGII (dgii_ecf_submissions) ----------
create table if not exists public.dgii_ecf_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  invoice_id uuid not null,
  environment text not null default 'TesteCF' check (environment in ('TesteCF', 'CerteCF', 'eCF')),
  ecf_type text not null check (ecf_type in ('E31', 'E32', 'E33', 'E34', 'E44', 'E45')),
  encf text,
  rnc_emisor text not null,
  rnc_comprador text,
  xml_unsigned text not null,
  xml_signed text,
  security_code text,
  track_id text,
  dgii_status text not null default 'draft_xml' check (dgii_status in ('draft_xml', 'signed', 'submitted', 'accepted', 'accepted_conditional', 'rejected', 'error')),
  dgii_response jsonb,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, invoice_id) references public.invoices (company_id, id) on delete cascade
);

create index if not exists dgii_ecf_invoice_idx on public.dgii_ecf_submissions (invoice_id, created_at desc);

drop trigger if exists trg_dgii_ecf_updated on public.dgii_ecf_submissions;
create trigger trg_dgii_ecf_updated before update on public.dgii_ecf_submissions
  for each row execute function app.set_updated_at();

-- ---------- 5. RLS para bank_accounts, cash_shifts y dgii_ecf_submissions ----------
alter table public.bank_accounts enable row level security;
alter table public.cash_shifts enable row level security;
alter table public.dgii_ecf_submissions enable row level security;

drop policy if exists bank_accounts_select on public.bank_accounts;
create policy bank_accounts_select on public.bank_accounts for select to authenticated
  using (app.is_member(company_id));

drop policy if exists bank_accounts_write on public.bank_accounts;
create policy bank_accounts_write on public.bank_accounts for all to authenticated
  using (app.has_permission(company_id, 'payments:write') or app.has_permission(company_id, 'company:manage'))
  with check (app.has_permission(company_id, 'payments:write') or app.has_permission(company_id, 'company:manage'));

drop policy if exists cash_shifts_select on public.cash_shifts;
create policy cash_shifts_select on public.cash_shifts for select to authenticated
  using (app.has_permission(company_id, 'payments:read'));

drop policy if exists cash_shifts_insert on public.cash_shifts;
create policy cash_shifts_insert on public.cash_shifts for insert to authenticated
  with check (app.has_permission(company_id, 'payments:write'));

drop policy if exists cash_shifts_update on public.cash_shifts;
create policy cash_shifts_update on public.cash_shifts for update to authenticated
  using (app.has_permission(company_id, 'payments:write'))
  with check (app.has_permission(company_id, 'payments:write'));

drop policy if exists dgii_ecf_select on public.dgii_ecf_submissions;
create policy dgii_ecf_select on public.dgii_ecf_submissions for select to authenticated
  using (app.has_permission(company_id, 'payments:read'));

drop policy if exists dgii_ecf_write on public.dgii_ecf_submissions;
create policy dgii_ecf_write on public.dgii_ecf_submissions for all to authenticated
  using (app.has_permission(company_id, 'payments:write'))
  with check (app.has_permission(company_id, 'payments:write'));

revoke all on public.bank_accounts, public.cash_shifts, public.dgii_ecf_submissions from anon;

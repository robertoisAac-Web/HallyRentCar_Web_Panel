-- Fase 4: pagos, cargos, depósitos, gastos, checklists, fotos y almacenamiento.
-- Aplicar con:  npx supabase migration up   (NO usar db reset: borra los datos).
-- ESTADO: escrita pero NO ejecutada.

-- ---------- permisos nuevos ----------
create or replace function app.seed_role_permissions(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.role_permissions (company_id, role, permission)
  select p_company, r.role::public.user_role, r.permission
  from (values
    ('admin','vehicles:read'),('admin','vehicles:write'),
    ('admin','customers:read'),('admin','customers:write'),
    ('admin','reservations:read'),('admin','reservations:write'),('admin','reservations:confirm'),
    ('admin','availability:write'),('admin','users:manage'),('admin','company:manage'),('admin','audit:read'),
    ('admin','payments:read'),('admin','payments:write'),('admin','payments:void'),
    ('admin','expenses:read'),('admin','expenses:write'),('admin','checklists:write'),('admin','reports:read'),
    ('employee','vehicles:read'),
    ('employee','customers:read'),('employee','customers:write'),
    ('employee','reservations:read'),('employee','reservations:write'),
    ('employee','availability:write'),
    ('employee','payments:read'),('employee','payments:write'),('employee','checklists:write'),
    -- contador: finanzas de solo lectura, sin clientes ni documentos
    ('accountant','payments:read'),('accountant','expenses:read'),('accountant','reports:read'),
    ('accountant','reservations:read'),('accountant','vehicles:read')
  ) as r(role, permission)
  on conflict do nothing;
end $$;
select app.seed_role_permissions(id) from public.companies;

-- ---------- funciones auxiliares ----------
create or replace function app.path_company(p text) returns uuid
language plpgsql immutable as $$
begin return split_part(p, '/', 1)::uuid; exception when others then return null; end $$;

-- Impide cambiar columnas distintas de las de anulación (los registros financieros no se editan ni borran).
create or replace function app.forbid_edit_except_void() returns trigger
language plpgsql as $$
declare a jsonb := to_jsonb(old) - 'voided_at' - 'voided_by' - 'void_reason';
        b jsonb := to_jsonb(new) - 'voided_at' - 'voided_by' - 'void_reason';
begin
  if a is distinct from b then
    raise exception 'Los registros financieros no se pueden editar; anúlalos y registra uno nuevo' using errcode = 'check_violation';
  end if;
  if old.voided_at is not null then
    raise exception 'El registro ya está anulado' using errcode = 'check_violation';
  end if;
  if new.voided_at is not null and (new.voided_by is null or new.void_reason is null or length(trim(new.void_reason)) = 0) then
    raise exception 'Anular exige usuario y motivo' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ---------- payments ----------
create type public.payment_kind as enum ('advance', 'payment', 'refund');
create type public.payment_method as enum ('cash', 'transfer', 'card', 'other');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  reservation_id uuid not null,
  kind public.payment_kind not null,
  method public.payment_method not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency in ('DOP','USD')),
  reference text,
  note text,
  paid_at timestamptz not null default now(),
  recorded_by uuid default auth.uid() references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_at timestamptz not null default now(),
  foreign key (company_id, reservation_id) references public.reservations (company_id, id) on delete restrict,
  check (method = 'cash' or length(trim(coalesce(reference, ''))) > 0)
);
create index payments_reservation_idx on public.payments (reservation_id);
create index payments_company_paid_idx on public.payments (company_id, paid_at);

create table public.reservation_charges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  reservation_id uuid not null,
  description text not null check (length(trim(description)) > 0),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency in ('DOP','USD')),
  created_by uuid default auth.uid() references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_at timestamptz not null default now(),
  foreign key (company_id, reservation_id) references public.reservations (company_id, id) on delete restrict
);
create index charges_reservation_idx on public.reservation_charges (reservation_id);

-- ---------- depósitos en garantía (separados de los ingresos) ----------
create type public.deposit_kind as enum ('received', 'returned', 'applied');

create table public.deposit_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  reservation_id uuid not null,
  kind public.deposit_kind not null,
  method public.payment_method,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency in ('DOP','USD')),
  reference text,
  note text,
  occurred_at timestamptz not null default now(),
  recorded_by uuid default auth.uid() references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_at timestamptz not null default now(),
  foreign key (company_id, reservation_id) references public.reservations (company_id, id) on delete restrict,
  -- recibir o devolver es una operación de dinero: exige método y, si no es efectivo, referencia
  check (kind = 'applied' or method is not null),
  check (kind = 'applied' or method = 'cash' or length(trim(coalesce(reference, ''))) > 0),
  -- una deducción debe estar justificada
  check (kind <> 'applied' or length(trim(coalesce(note, ''))) > 0)
);
create index deposit_reservation_idx on public.deposit_movements (reservation_id);

-- ---------- reglas de integridad financiera ----------
create or replace function app.money_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cur text;
begin
  select currency into cur from public.reservations where id = new.reservation_id for update;
  if cur is null then raise exception 'Reserva no encontrada'; end if;
  if cur <> new.currency then
    raise exception 'La moneda (%) no coincide con la de la reserva (%)', new.currency, cur using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger trg_payments_before_ins before insert on public.payments for each row execute function app.money_before_insert();
create trigger trg_charges_before_ins before insert on public.reservation_charges for each row execute function app.money_before_insert();
create trigger trg_deposit_before_ins before insert on public.deposit_movements for each row execute function app.money_before_insert();

create trigger trg_payments_immutable before update on public.payments for each row execute function app.forbid_edit_except_void();
create trigger trg_charges_immutable before update on public.reservation_charges for each row execute function app.forbid_edit_except_void();
create trigger trg_deposit_immutable before update on public.deposit_movements for each row execute function app.forbid_edit_except_void();

-- Lo recibido neto (pagos - reembolsos) nunca puede ser negativo.
create or replace function app.payments_check_net() returns trigger
language plpgsql security definer set search_path = '' as $$
declare net numeric;
begin
  perform 1 from public.reservations where id = new.reservation_id for update;
  select coalesce(sum(case when kind = 'refund' then -amount else amount end), 0) into net
  from public.payments where reservation_id = new.reservation_id and voided_at is null;
  if net < 0 then
    raise exception 'El reembolso supera lo cobrado en esta reserva' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create constraint trigger trg_payments_net after insert or update on public.payments
  deferrable initially immediate for each row execute function app.payments_check_net();

-- El depósito retenido nunca puede ser negativo (no se devuelve ni aplica más de lo recibido).
create or replace function app.deposit_check_held() returns trigger
language plpgsql security definer set search_path = '' as $$
declare held numeric;
begin
  perform 1 from public.reservations where id = new.reservation_id for update;
  select coalesce(sum(case when kind = 'received' then amount else -amount end), 0) into held
  from public.deposit_movements where reservation_id = new.reservation_id and voided_at is null;
  if held < 0 then
    raise exception 'No se puede devolver ni aplicar más de lo recibido en depósito' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create constraint trigger trg_deposit_held after insert or update on public.deposit_movements
  deferrable initially immediate for each row execute function app.deposit_check_held();

-- ---------- gastos ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  vehicle_id uuid,
  category text not null check (category in ('maintenance','repair','wash','fuel','insurance','taxes','commission','other')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'DOP' check (currency in ('DOP','USD')),
  expense_date date not null,
  vendor text,
  description text,
  receipt_path text,
  created_by uuid default auth.uid() references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_at timestamptz not null default now(),
  foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict
);
create index expenses_company_date_idx on public.expenses (company_id, expense_date);
create trigger trg_expenses_immutable before update on public.expenses for each row execute function app.forbid_edit_except_void();

-- ---------- checklists de entrega y devolución ----------
create table public.rental_checklists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  reservation_id uuid not null,
  kind text not null check (kind in ('pickup','return')),
  odometer_km int not null check (odometer_km >= 0),
  fuel_level text not null check (fuel_level in ('empty','quarter','half','three_quarters','full')),
  condition_notes text,
  damages text,
  accessories text,
  observations text,
  photos text[] not null default '{}',
  performed_by uuid default auth.uid() references auth.users(id),
  performed_at timestamptz not null default now(),
  foreign key (company_id, reservation_id) references public.reservations (company_id, id) on delete restrict,
  unique (reservation_id, kind)
);

create or replace function app.checklist_update_mileage() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.vehicles v set mileage_km = greatest(v.mileage_km, new.odometer_km)
  from public.reservations r where r.id = new.reservation_id and v.id = r.vehicle_id;
  return new;
end $$;
create trigger trg_checklist_mileage after insert on public.rental_checklists for each row execute function app.checklist_update_mileage();

-- ---------- fotos de vehículos ----------
create table public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  vehicle_id uuid not null,
  path text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  unique (company_id, path)
);
create index vehicle_photos_vehicle_idx on public.vehicle_photos (vehicle_id);

-- ---------- auditoría ----------
create trigger trg_audit_payments after insert or update or delete on public.payments for each row execute function app.audit_row();
create trigger trg_audit_charges after insert or update or delete on public.reservation_charges for each row execute function app.audit_row();
create trigger trg_audit_deposits after insert or update or delete on public.deposit_movements for each row execute function app.audit_row();
create trigger trg_audit_expenses after insert or update or delete on public.expenses for each row execute function app.audit_row();
create trigger trg_audit_checklists after insert or update or delete on public.rental_checklists for each row execute function app.audit_row();
create trigger trg_audit_vphotos after insert or update or delete on public.vehicle_photos for each row execute function app.audit_row();

-- ---------- RLS ----------
alter table public.payments enable row level security;
alter table public.reservation_charges enable row level security;
alter table public.deposit_movements enable row level security;
alter table public.expenses enable row level security;
alter table public.rental_checklists enable row level security;
alter table public.vehicle_photos enable row level security;

create policy payments_select on public.payments for select to authenticated using (app.has_permission(company_id, 'payments:read'));
create policy payments_insert on public.payments for insert to authenticated with check (app.has_permission(company_id, 'payments:write'));
create policy payments_void on public.payments for update to authenticated
  using (app.has_permission(company_id, 'payments:void')) with check (app.has_permission(company_id, 'payments:void'));

create policy charges_select on public.reservation_charges for select to authenticated using (app.has_permission(company_id, 'payments:read'));
create policy charges_insert on public.reservation_charges for insert to authenticated with check (app.has_permission(company_id, 'payments:write'));
create policy charges_void on public.reservation_charges for update to authenticated
  using (app.has_permission(company_id, 'payments:void')) with check (app.has_permission(company_id, 'payments:void'));

create policy deposit_select on public.deposit_movements for select to authenticated using (app.has_permission(company_id, 'payments:read'));
create policy deposit_insert on public.deposit_movements for insert to authenticated with check (app.has_permission(company_id, 'payments:write'));
create policy deposit_void on public.deposit_movements for update to authenticated
  using (app.has_permission(company_id, 'payments:void')) with check (app.has_permission(company_id, 'payments:void'));

create policy expenses_select on public.expenses for select to authenticated using (app.has_permission(company_id, 'expenses:read'));
create policy expenses_insert on public.expenses for insert to authenticated with check (app.has_permission(company_id, 'expenses:write'));
create policy expenses_void on public.expenses for update to authenticated
  using (app.has_permission(company_id, 'expenses:write')) with check (app.has_permission(company_id, 'expenses:write'));

create policy checklists_select on public.rental_checklists for select to authenticated using (app.has_permission(company_id, 'reservations:read'));
create policy checklists_insert on public.rental_checklists for insert to authenticated with check (app.has_permission(company_id, 'checklists:write'));

create policy vphotos_select on public.vehicle_photos for select to authenticated using (app.has_permission(company_id, 'vehicles:read'));
create policy vphotos_insert on public.vehicle_photos for insert to authenticated with check (app.has_permission(company_id, 'vehicles:write'));
create policy vphotos_update on public.vehicle_photos for update to authenticated
  using (app.has_permission(company_id, 'vehicles:write')) with check (app.has_permission(company_id, 'vehicles:write'));
create policy vphotos_delete on public.vehicle_photos for delete to authenticated using (app.has_permission(company_id, 'vehicles:write'));

-- La anulación de pagos cobrados solo la hace quien tenga payments:void; nadie borra desde el cliente.
revoke delete on public.payments, public.reservation_charges, public.deposit_movements, public.expenses, public.rental_checklists from authenticated;
revoke all on public.payments, public.reservation_charges, public.deposit_movements, public.expenses,
  public.rental_checklists, public.vehicle_photos from anon;

-- ---------- almacenamiento ----------
-- Convención de ruta: <company_id>/<carpeta>/<archivo>
insert into storage.buckets (id, name, public) values
  ('vehicle-photos', 'vehicle-photos', true),      -- fotos del catálogo: lectura pública por URL
  ('expense-receipts', 'expense-receipts', false), -- privado
  ('checklist-photos', 'checklist-photos', false)  -- privado
on conflict (id) do nothing;

create policy vehicle_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicle-photos' and app.has_permission(app.path_company(name), 'vehicles:write'));
create policy vehicle_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'vehicle-photos' and app.has_permission(app.path_company(name), 'vehicles:write'));

create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'expense-receipts' and app.has_permission(app.path_company(name), 'expenses:read'));
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-receipts' and app.has_permission(app.path_company(name), 'expenses:write'));

create policy checklist_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'checklist-photos' and app.has_permission(app.path_company(name), 'reservations:read'));
create policy checklist_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'checklist-photos' and app.has_permission(app.path_company(name), 'checklists:write'));

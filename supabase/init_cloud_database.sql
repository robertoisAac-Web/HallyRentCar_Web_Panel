-- ==============================================================================
-- HALLY RENT CAR - SCRIPT COMPLETO DE INICIALIZACIÓN DE BASE DE DATOS SUPABASE
-- Ejecutar este archivo completo en: Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Extensiones y Esquema
create extension if not exists btree_gist;
create extension if not exists pgcrypto;
create schema if not exists app;

-- Tipos enum
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'employee', 'accountant');
  end if;
  if not exists (select 1 from pg_type where typname = 'block_kind') then
    create type public.block_kind as enum ('maintenance', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type public.reservation_status as enum ('pending','in_review','confirmed','in_progress','completed','rejected','cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'reservation_channel') then
    create type public.reservation_channel as enum ('website','whatsapp','instagram','phone','referral','other_rental','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_kind') then
    create type public.payment_kind as enum ('advance', 'payment', 'refund');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum ('cash', 'transfer', 'card', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'deposit_kind') then
    create type public.deposit_kind as enum ('received', 'returned', 'applied');
  end if;
end $$;

-- Funciones utilitarias base
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function app.path_company(p text) returns uuid
language plpgsql immutable as $$
begin return split_part(p, '/', 1)::uuid; exception when others then return null; end $$;

-- 2. Tabla Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  legal_name text,
  rnc text,
  phone text,
  whatsapp_number text,
  default_currency text not null default 'DOP' check (default_currency in ('DOP','USD')),
  timezone text not null default 'America/Santo_Domingo',
  grace_minutes int not null default 59 check (grace_minutes >= 0),
  turnaround_minutes int not null default 0 check (turnaround_minutes >= 0),
  pending_expiry_hours int not null default 72 check (pending_expiry_hours > 0),
  tagline text,
  address text,
  delivery_zones text,
  terms_text text,
  public_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_companies_updated on public.companies;
create trigger trg_companies_updated before update on public.companies
  for each row execute function app.set_updated_at();

-- 3. Profiles (1:1 con auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function app.set_updated_at();

create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- 4. Memberships y Permisos
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships (user_id) where is_active;

drop trigger if exists trg_memberships_updated on public.memberships;
create trigger trg_memberships_updated before update on public.memberships
  for each row execute function app.set_updated_at();

create or replace function app.protect_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
declare others int;
begin
  if tg_op = 'DELETE' then
    if not (old.role = 'admin' and old.is_active) then return old; end if;
  else
    if not (old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active)) then return new; end if;
  end if;
  select count(*) into others from public.memberships
   where company_id = old.company_id and role = 'admin' and is_active and id <> old.id;
  if others = 0 then
    raise exception 'Debe quedar al menos un administrador activo' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_protect_last_admin on public.memberships;
create trigger trg_protect_last_admin before update or delete on public.memberships
  for each row execute function app.protect_last_admin();

create table if not exists public.role_permissions (
  company_id uuid not null references public.companies(id) on delete cascade,
  role public.user_role not null,
  permission text not null,
  primary key (company_id, role, permission)
);

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
    ('accountant','payments:read'),('accountant','expenses:read'),('accountant','reports:read'),
    ('accountant','reservations:read'),('accountant','vehicles:read')
  ) as r(role, permission)
  on conflict do nothing;
end $$;

create or replace function app.on_company_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform app.seed_role_permissions(new.id); return new; end $$;

drop trigger if exists trg_company_seed_permissions on public.companies;
create trigger trg_company_seed_permissions after insert on public.companies
  for each row execute function app.on_company_created();

-- Helpers de autorización
create or replace function app.is_member(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
    where m.user_id = auth.uid() and m.company_id = p_company and m.is_active)
$$;

create or replace function app.has_permission(p_company uuid, p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.role_permissions rp
      on rp.company_id = m.company_id and rp.role = m.role
    where m.user_id = auth.uid() and m.company_id = p_company and m.is_active
      and rp.permission = p_permission)
$$;

revoke all on function app.is_member(uuid), app.has_permission(uuid, text) from public;
grant execute on function app.is_member(uuid), app.has_permission(uuid, text) to authenticated;
grant usage on schema app to authenticated;

-- 5. Auditoría
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete restrict,
  user_id uuid,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_company_created_idx on public.audit_logs (company_id, created_at desc);

create or replace function app.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb; cid uuid;
begin
  j := to_jsonb(coalesce(new, old));
  cid := coalesce((j->>'company_id')::uuid, (j->>'id')::uuid);
  insert into public.audit_logs (company_id, user_id, action, table_name, record_id, old_data, new_data)
  values (cid, auth.uid(), tg_op, tg_table_name, j->>'id',
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_audit_companies on public.companies;
create trigger trg_audit_companies after insert or update or delete on public.companies for each row execute function app.audit_row();
drop trigger if exists trg_audit_memberships on public.memberships;
create trigger trg_audit_memberships after insert or update or delete on public.memberships for each row execute function app.audit_row();

-- 6. Flota (Vehicles y Fotos)
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  make text not null,
  model text not null,
  year int not null check (year between 1980 and 2100),
  plate text not null,
  vin text,
  mileage_km int not null default 0 check (mileage_km >= 0),
  transmission text check (transmission in ('automatic','manual')),
  fuel_type text,
  seats int check (seats > 0),
  daily_rate numeric(12,2) not null check (daily_rate >= 0),
  currency text not null default 'DOP' check (currency in ('DOP','USD')),
  features jsonb not null default '[]'::jsonb,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, plate)
);
drop trigger if exists trg_vehicles_updated on public.vehicles;
create trigger trg_vehicles_updated before update on public.vehicles for each row execute function app.set_updated_at();
drop trigger if exists trg_audit_vehicles on public.vehicles;
create trigger trg_audit_vehicles after insert or update or delete on public.vehicles for each row execute function app.audit_row();

create table if not exists public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  vehicle_id uuid not null,
  path text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  unique (company_id, path)
);
create index if not exists vehicle_photos_vehicle_idx on public.vehicle_photos (vehicle_id);

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  vehicle_id uuid not null,
  doc_type text not null check (doc_type in ('insurance','registration','inspection','other')),
  number text,
  expires_on date,
  file_path text,
  notes text,
  created_at timestamptz not null default now(),
  foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict
);
create index if not exists vehicle_documents_vehicle_idx on public.vehicle_documents (vehicle_id);
create index if not exists vehicle_documents_expiry_idx on public.vehicle_documents (company_id, expires_on);

-- 7. Clientes
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text,
  email text,
  country text,
  id_type text check (id_type in ('cedula','passport','other')),
  id_number text,
  license_number text,
  license_expires_on date,
  notes text,
  risk_flag boolean not null default false,
  risk_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  check ((id_type is null) = (id_number is null))
);
create unique index if not exists customers_identity_uq on public.customers (company_id, id_type, id_number) where id_number is not null;
create index if not exists customers_phone_idx on public.customers (company_id, phone);
drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated before update on public.customers for each row execute function app.set_updated_at();
drop trigger if exists trg_audit_customers on public.customers;
create trigger trg_audit_customers after insert or update or delete on public.customers for each row execute function app.audit_row();

-- 8. Bloqueos de Vehículos
create table if not exists public.vehicle_blocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  vehicle_id uuid not null,
  kind public.block_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  period tstzrange not null,
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, vehicle_id) references public.vehicles (company_id, id) on delete restrict,
  check (ends_at > starts_at),
  constraint vehicle_blocks_no_self_overlap exclude using gist (vehicle_id with =, period with &&)
);
drop trigger if exists trg_vehicle_blocks_updated on public.vehicle_blocks;
create trigger trg_vehicle_blocks_updated before update on public.vehicle_blocks for each row execute function app.set_updated_at();
drop trigger if exists trg_audit_blocks on public.vehicle_blocks;
create trigger trg_audit_blocks after insert or update or delete on public.vehicle_blocks for each row execute function app.audit_row();

-- 9. Secuencias y Reservas
create table if not exists public.company_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  value bigint not null default 0,
  primary key (company_id, name)
);

create or replace function app.next_sequence(p_company uuid, p_name text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  insert into public.company_sequences (company_id, name, value) values (p_company, p_name, 1)
  on conflict (company_id, name) do update set value = public.company_sequences.value + 1
  returning value into v;
  return v;
end $$;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  code text not null,
  customer_id uuid not null,
  vehicle_id uuid not null,
  status public.reservation_status not null default 'pending',
  channel public.reservation_channel not null,
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  buffer_minutes int not null default 0 check (buffer_minutes >= 0),
  period tstzrange not null,
  pickup_location text,
  return_location text,
  daily_rate numeric(12,2) not null check (daily_rate >= 0),
  billable_days int not null check (billable_days >= 1),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  extras_total numeric(12,2) not null default 0 check (extras_total >= 0),
  total_amount numeric(12,2) not null,
  currency text not null default 'DOP' check (currency in ('DOP','USD')),
  deposit_required numeric(12,2) not null default 0 check (deposit_required >= 0),
  expires_at timestamptz,
  internal_notes text,
  customer_message text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, code),
  foreign key (company_id, customer_id) references public.customers (company_id, id) on delete restrict,
  foreign key (company_id, vehicle_id)  references public.vehicles  (company_id, id) on delete restrict,
  check (return_at > pickup_at),
  check (total_amount = round(daily_rate * billable_days - discount_total + extras_total, 2)),
  check (total_amount >= 0),
  constraint reservations_no_overlap exclude using gist (vehicle_id with =, period with &&) where (status in ('confirmed','in_progress'))
);
create index if not exists reservations_company_status_idx on public.reservations (company_id, status);
create index if not exists reservations_vehicle_period_idx on public.reservations using gist (vehicle_id, period);

create or replace function app.reservations_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare yr text;
begin
  if tg_op = 'INSERT' and (new.code is null or new.code = '') then
    yr := to_char(now() at time zone 'America/Santo_Domingo', 'YYYY');
    new.code := 'RC-' || yr || '-' || lpad(app.next_sequence(new.company_id, 'reservation-' || yr)::text, 4, '0');
  end if;
  new.period := tstzrange(new.pickup_at, new.return_at + make_interval(mins => new.buffer_minutes), '[)');
  return new;
end $$;

drop trigger if exists trg_reservations_before on public.reservations;
create trigger trg_reservations_before before insert or update on public.reservations for each row execute function app.reservations_before_write();
drop trigger if exists trg_reservations_updated on public.reservations;
create trigger trg_reservations_updated before update on public.reservations for each row execute function app.set_updated_at();

create or replace function app.reservations_check_transition() returns trigger
language plpgsql as $$
begin
  if new.status = old.status then return new; end if;
  if not (
       (old.status = 'pending'     and new.status in ('in_review','confirmed','rejected','cancelled'))
    or (old.status = 'in_review'   and new.status in ('confirmed','rejected','cancelled'))
    or (old.status = 'confirmed'   and new.status in ('in_progress','cancelled'))
    or (old.status = 'in_progress' and new.status = 'completed')
  ) then
    raise exception 'Transición de estado no permitida: % -> %', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_reservations_transition on public.reservations;
create trigger trg_reservations_transition before update of status on public.reservations for each row execute function app.reservations_check_transition();

create table if not exists public.reservation_status_history (
  id bigint generated always as identity primary key,
  company_id uuid not null,
  reservation_id uuid not null,
  from_status public.reservation_status,
  to_status public.reservation_status not null,
  changed_by uuid,
  reason text,
  created_at timestamptz not null default now(),
  foreign key (company_id, reservation_id) references public.reservations (company_id, id) on delete restrict
);
create index if not exists rsh_reservation_idx on public.reservation_status_history (reservation_id, created_at);

create or replace function app.reservations_log_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.reservation_status_history (company_id, reservation_id, from_status, to_status, changed_by)
    values (new.company_id, new.id,
            case when tg_op = 'INSERT' then null else old.status end, new.status, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_reservations_log on public.reservations;
create trigger trg_reservations_log after insert or update on public.reservations for each row execute function app.reservations_log_status();

create or replace function app.check_reservation_vs_blocks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('confirmed','in_progress') then
    perform 1 from public.vehicles where id = new.vehicle_id for update;
    if exists (select 1 from public.vehicle_blocks b where b.vehicle_id = new.vehicle_id and b.period && new.period) then
      raise exception 'El vehículo está bloqueado en ese período' using errcode = 'exclusion_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_reservations_vs_blocks on public.reservations;
create trigger trg_reservations_vs_blocks after insert or update on public.reservations for each row execute function app.check_reservation_vs_blocks();

create or replace function app.blocks_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.period := tstzrange(new.starts_at, new.ends_at, '[)');
  perform 1 from public.vehicles where id = new.vehicle_id for update;
  if exists (select 1 from public.reservations r where r.vehicle_id = new.vehicle_id and r.status in ('confirmed','in_progress') and r.period && new.period) then
    raise exception 'Existen reservas confirmadas en ese período' using errcode = 'exclusion_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_blocks_before on public.vehicle_blocks;
create trigger trg_blocks_before before insert or update on public.vehicle_blocks for each row execute function app.blocks_before_write();

drop trigger if exists trg_audit_reservations on public.reservations;
create trigger trg_audit_reservations after insert or update or delete on public.reservations for each row execute function app.audit_row();

-- 10. Pagos, Cargos, Depósitos y Gastos
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

create table if not exists public.payments (
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
create index if not exists payments_reservation_idx on public.payments (reservation_id);
create index if not exists payments_company_paid_idx on public.payments (company_id, paid_at);

create table if not exists public.reservation_charges (
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
create index if not exists charges_reservation_idx on public.reservation_charges (reservation_id);

create table if not exists public.deposit_movements (
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
  check (kind = 'applied' or method is not null),
  check (kind = 'applied' or method = 'cash' or length(trim(coalesce(reference, ''))) > 0),
  check (kind <> 'applied' or length(trim(coalesce(note, ''))) > 0)
);
create index if not exists deposit_reservation_idx on public.deposit_movements (reservation_id);

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

drop trigger if exists trg_payments_before_ins on public.payments;
create trigger trg_payments_before_ins before insert on public.payments for each row execute function app.money_before_insert();
drop trigger if exists trg_charges_before_ins on public.reservation_charges;
create trigger trg_charges_before_ins before insert on public.reservation_charges for each row execute function app.money_before_insert();
drop trigger if exists trg_deposit_before_ins on public.deposit_movements;
create trigger trg_deposit_before_ins before insert on public.deposit_movements for each row execute function app.money_before_insert();

drop trigger if exists trg_payments_immutable on public.payments;
create trigger trg_payments_immutable before update on public.payments for each row execute function app.forbid_edit_except_void();
drop trigger if exists trg_charges_immutable on public.reservation_charges;
create trigger trg_charges_immutable before update on public.reservation_charges for each row execute function app.forbid_edit_except_void();
drop trigger if exists trg_deposit_immutable on public.deposit_movements;
create trigger trg_deposit_immutable before update on public.deposit_movements for each row execute function app.forbid_edit_except_void();

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

drop trigger if exists trg_payments_net on public.payments;
create constraint trigger trg_payments_net after insert or update on public.payments deferrable initially immediate for each row execute function app.payments_check_net();

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

drop trigger if exists trg_deposit_held on public.deposit_movements;
create constraint trigger trg_deposit_held after insert or update on public.deposit_movements deferrable initially immediate for each row execute function app.deposit_check_held();

create table if not exists public.expenses (
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
create index if not exists expenses_company_date_idx on public.expenses (company_id, expense_date);
drop trigger if exists trg_expenses_immutable on public.expenses;
create trigger trg_expenses_immutable before update on public.expenses for each row execute function app.forbid_edit_except_void();

create table if not exists public.rental_checklists (
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

drop trigger if exists trg_checklist_mileage on public.rental_checklists;
create trigger trg_checklist_mileage after insert on public.rental_checklists for each row execute function app.checklist_update_mileage();

-- 11. Solicitudes Públicas
create table if not exists public.public_request_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  ip_hash text not null,
  phone text not null,
  created_at timestamptz not null default now()
);
create index if not exists public_request_log_ip_idx on public.public_request_log (ip_hash, created_at);
create index if not exists public_request_log_phone_idx on public.public_request_log (company_id, phone, created_at);

create or replace function public.create_public_request(
  p_company uuid, p_vehicle uuid, p_pickup timestamptz, p_return timestamptz,
  p_name text, p_phone text, p_email text, p_pickup_location text, p_return_location text,
  p_message text, p_ip_hash text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c record; v record; v_cust uuid; v_days int; v_total numeric; v_code text; v_digits text; v_range tstzrange;
begin
  select * into c from public.companies where id = p_company;
  if not found or not c.public_enabled then raise exception 'PUBLIC_DISABLED'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 120 then raise exception 'INVALID_NAME'; end if;
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_digits) < 7 or length(v_digits) > 15 then raise exception 'INVALID_PHONE'; end if;
  if length(coalesce(p_email, '')) > 0 and p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'INVALID_EMAIL'; end if;
  if length(coalesce(p_message, '')) > 1000 or length(coalesce(p_pickup_location, '')) > 200 or length(coalesce(p_return_location, '')) > 200
    then raise exception 'INVALID_TEXT'; end if;
  if p_return <= p_pickup or p_pickup < now() - interval '1 hour' or p_return - p_pickup > interval '90 days'
    then raise exception 'INVALID_DATES'; end if;

  if (select count(*) from public.public_request_log where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.public_request_log where company_id = p_company and phone = v_digits and created_at > now() - interval '1 day') >= 3
  then raise exception 'RATE_LIMITED'; end if;

  select * into v from public.vehicles where id = p_vehicle and company_id = p_company and is_active;
  if not found then raise exception 'VEHICLE_UNAVAILABLE'; end if;
  perform 1 from public.vehicles where id = v.id for update;

  v_range := tstzrange(p_pickup, p_return + make_interval(mins => c.turnaround_minutes), '[)');
  if exists (select 1 from public.reservations r where r.vehicle_id = v.id and r.status in ('confirmed', 'in_progress') and r.period && v_range)
     or exists (select 1 from public.vehicle_blocks b where b.vehicle_id = v.id and b.period && v_range)
  then raise exception 'VEHICLE_UNAVAILABLE'; end if;

  select id into v_cust from public.customers
   where company_id = p_company and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_digits
     and lower(trim(full_name)) = lower(trim(p_name)) limit 1;
  if v_cust is null then
    insert into public.customers (company_id, full_name, phone, email)
    values (p_company, trim(p_name), trim(p_phone), nullif(trim(coalesce(p_email, '')), '')) returning id into v_cust;
  end if;

  v_days := greatest(1, ceil((extract(epoch from (p_return - p_pickup)) / 60 - c.grace_minutes) / 1440.0)::int);
  v_total := round(v.daily_rate * v_days, 2);

  insert into public.reservations (company_id, customer_id, vehicle_id, status, channel, pickup_at, return_at, buffer_minutes,
    pickup_location, return_location, daily_rate, billable_days, total_amount, currency, expires_at, customer_message)
  values (p_company, v_cust, v.id, 'pending', 'website', p_pickup, p_return, c.turnaround_minutes,
    nullif(trim(coalesce(p_pickup_location, '')), ''), nullif(trim(coalesce(p_return_location, '')), ''),
    v.daily_rate, v_days, v_total, v.currency, now() + make_interval(hours => c.pending_expiry_hours),
    nullif(trim(coalesce(p_message, '')), ''))
  returning code into v_code;

  insert into public.public_request_log (company_id, ip_hash, phone) values (p_company, p_ip_hash, v_digits);
  return v_code;
end $$;

grant execute on function public.create_public_request to service_role;

-- 12. RLS y Permisos de Seguridad
alter table public.companies                  enable row level security;
alter table public.profiles                   enable row level security;
alter table public.memberships                enable row level security;
alter table public.role_permissions           enable row level security;
alter table public.audit_logs                 enable row level security;
alter table public.vehicles                   enable row level security;
alter table public.customers                  enable row level security;
alter table public.vehicle_blocks             enable row level security;
alter table public.reservations               enable row level security;
alter table public.reservation_status_history enable row level security;
alter table public.company_sequences          enable row level security;
alter table public.payments                   enable row level security;
alter table public.reservation_charges        enable row level security;
alter table public.deposit_movements          enable row level security;
alter table public.expenses                   enable row level security;
alter table public.rental_checklists          enable row level security;
alter table public.vehicle_photos             enable row level security;
alter table public.vehicle_documents          enable row level security;
alter table public.public_request_log         enable row level security;

-- Políticas de lectura/escritura seguras
do $$ begin
  -- companies
  drop policy if exists companies_select on public.companies;
  create policy companies_select on public.companies for select to authenticated using (app.is_member(id));
  drop policy if exists companies_update on public.companies;
  create policy companies_update on public.companies for update to authenticated using (app.has_permission(id, 'company:manage')) with check (app.has_permission(id, 'company:manage'));

  -- profiles
  drop policy if exists profiles_select on public.profiles;
  create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.company_id = mine.company_id
    where mine.user_id = auth.uid() and mine.is_active and theirs.user_id = profiles.id));
  drop policy if exists profiles_update_own on public.profiles;
  create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

  -- memberships
  drop policy if exists memberships_select on public.memberships;
  create policy memberships_select on public.memberships for select to authenticated using (user_id = auth.uid() or app.has_permission(company_id, 'users:manage'));
  drop policy if exists memberships_write on public.memberships;
  create policy memberships_write on public.memberships for all to authenticated using (app.has_permission(company_id, 'users:manage')) with check (app.has_permission(company_id, 'users:manage'));

  -- role_permissions
  drop policy if exists role_permissions_select on public.role_permissions;
  create policy role_permissions_select on public.role_permissions for select to authenticated using (app.is_member(company_id));
  drop policy if exists role_permissions_write on public.role_permissions;
  create policy role_permissions_write on public.role_permissions for all to authenticated using (app.has_permission(company_id, 'users:manage')) with check (app.has_permission(company_id, 'users:manage'));

  -- audit_logs
  drop policy if exists audit_select on public.audit_logs;
  create policy audit_select on public.audit_logs for select to authenticated using (app.has_permission(company_id, 'audit:read'));

  -- vehicles
  drop policy if exists vehicles_select on public.vehicles;
  create policy vehicles_select on public.vehicles for select to authenticated using (app.has_permission(company_id, 'vehicles:read'));
  drop policy if exists vehicles_insert on public.vehicles;
  create policy vehicles_insert on public.vehicles for insert to authenticated with check (app.has_permission(company_id, 'vehicles:write'));
  drop policy if exists vehicles_update on public.vehicles;
  create policy vehicles_update on public.vehicles for update to authenticated using (app.has_permission(company_id, 'vehicles:write')) with check (app.has_permission(company_id, 'vehicles:write'));

  -- customers
  drop policy if exists customers_select on public.customers;
  create policy customers_select on public.customers for select to authenticated using (app.has_permission(company_id, 'customers:read'));
  drop policy if exists customers_insert on public.customers;
  create policy customers_insert on public.customers for insert to authenticated with check (app.has_permission(company_id, 'customers:write'));
  drop policy if exists customers_update on public.customers;
  create policy customers_update on public.customers for update to authenticated using (app.has_permission(company_id, 'customers:write')) with check (app.has_permission(company_id, 'customers:write'));

  -- vehicle_blocks
  drop policy if exists blocks_select on public.vehicle_blocks;
  create policy blocks_select on public.vehicle_blocks for select to authenticated using (app.has_permission(company_id, 'vehicles:read'));
  drop policy if exists blocks_insert on public.vehicle_blocks;
  create policy blocks_insert on public.vehicle_blocks for insert to authenticated with check (app.has_permission(company_id, 'availability:write'));
  drop policy if exists blocks_update on public.vehicle_blocks;
  create policy blocks_update on public.vehicle_blocks for update to authenticated using (app.has_permission(company_id, 'availability:write')) with check (app.has_permission(company_id, 'availability:write'));
  drop policy if exists blocks_delete on public.vehicle_blocks;
  create policy blocks_delete on public.vehicle_blocks for delete to authenticated using (app.has_permission(company_id, 'availability:write'));

  -- reservations
  drop policy if exists reservations_select on public.reservations;
  create policy reservations_select on public.reservations for select to authenticated using (app.has_permission(company_id, 'reservations:read'));
  drop policy if exists reservations_insert on public.reservations;
  create policy reservations_insert on public.reservations for insert to authenticated with check (app.has_permission(company_id, 'reservations:write'));
  drop policy if exists reservations_update on public.reservations;
  create policy reservations_update on public.reservations for update to authenticated using (app.has_permission(company_id, 'reservations:write')) with check (app.has_permission(company_id, 'reservations:write'));

  -- rsh
  drop policy if exists rsh_select on public.reservation_status_history;
  create policy rsh_select on public.reservation_status_history for select to authenticated using (app.has_permission(company_id, 'reservations:read'));

  -- payments
  drop policy if exists payments_select on public.payments;
  create policy payments_select on public.payments for select to authenticated using (app.has_permission(company_id, 'payments:read'));
  drop policy if exists payments_insert on public.payments;
  create policy payments_insert on public.payments for insert to authenticated with check (app.has_permission(company_id, 'payments:write'));
  drop policy if exists payments_void on public.payments;
  create policy payments_void on public.payments for update to authenticated using (app.has_permission(company_id, 'payments:void')) with check (app.has_permission(company_id, 'payments:void'));

  -- charges
  drop policy if exists charges_select on public.reservation_charges;
  create policy charges_select on public.reservation_charges for select to authenticated using (app.has_permission(company_id, 'payments:read'));
  drop policy if exists charges_insert on public.reservation_charges;
  create policy charges_insert on public.reservation_charges for insert to authenticated with check (app.has_permission(company_id, 'payments:write'));
  drop policy if exists charges_void on public.reservation_charges;
  create policy charges_void on public.reservation_charges for update to authenticated using (app.has_permission(company_id, 'payments:void')) with check (app.has_permission(company_id, 'payments:void'));

  -- deposits
  drop policy if exists deposit_select on public.deposit_movements;
  create policy deposit_select on public.deposit_movements for select to authenticated using (app.has_permission(company_id, 'payments:read'));
  drop policy if exists deposit_insert on public.deposit_movements;
  create policy deposit_insert on public.deposit_movements for insert to authenticated with check (app.has_permission(company_id, 'payments:write'));
  drop policy if exists deposit_void on public.deposit_movements;
  create policy deposit_void on public.deposit_movements for update to authenticated using (app.has_permission(company_id, 'payments:void')) with check (app.has_permission(company_id, 'payments:void'));

  -- expenses
  drop policy if exists expenses_select on public.expenses;
  create policy expenses_select on public.expenses for select to authenticated using (app.has_permission(company_id, 'expenses:read'));
  drop policy if exists expenses_insert on public.expenses;
  create policy expenses_insert on public.expenses for insert to authenticated with check (app.has_permission(company_id, 'expenses:write'));
  drop policy if exists expenses_void on public.expenses;
  create policy expenses_void on public.expenses for update to authenticated using (app.has_permission(company_id, 'expenses:write')) with check (app.has_permission(company_id, 'expenses:write'));

  -- checklists
  drop policy if exists checklists_select on public.rental_checklists;
  create policy checklists_select on public.rental_checklists for select to authenticated using (app.has_permission(company_id, 'reservations:read'));
  drop policy if exists checklists_insert on public.rental_checklists;
  create policy checklists_insert on public.rental_checklists for insert to authenticated with check (app.has_permission(company_id, 'checklists:write'));

  -- photos
  drop policy if exists vphotos_select on public.vehicle_photos;
  create policy vphotos_select on public.vehicle_photos for select to authenticated using (app.has_permission(company_id, 'vehicles:read'));
  drop policy if exists vphotos_insert on public.vehicle_photos;
  create policy vphotos_insert on public.vehicle_photos for insert to authenticated with check (app.has_permission(company_id, 'vehicles:write'));
  drop policy if exists vphotos_update on public.vehicle_photos;
  create policy vphotos_update on public.vehicle_photos for update to authenticated using (app.has_permission(company_id, 'vehicles:write')) with check (app.has_permission(company_id, 'vehicles:write'));
  drop policy if exists vphotos_delete on public.vehicle_photos;
  create policy vphotos_delete on public.vehicle_photos for delete to authenticated using (app.has_permission(company_id, 'vehicles:write'));

  -- vehicle documents
  drop policy if exists vdocs_select on public.vehicle_documents;
  create policy vdocs_select on public.vehicle_documents for select to authenticated using (app.has_permission(company_id, 'vehicles:read'));
  drop policy if exists vdocs_insert on public.vehicle_documents;
  create policy vdocs_insert on public.vehicle_documents for insert to authenticated with check (app.has_permission(company_id, 'vehicles:write'));
  drop policy if exists vdocs_update on public.vehicle_documents;
  create policy vdocs_update on public.vehicle_documents for update to authenticated using (app.has_permission(company_id, 'vehicles:write')) with check (app.has_permission(company_id, 'vehicles:write'));
  drop policy if exists vdocs_delete on public.vehicle_documents;
  create policy vdocs_delete on public.vehicle_documents for delete to authenticated using (app.has_permission(company_id, 'vehicles:write'));
end $$;

-- 13. Buckets de Almacenamiento
insert into storage.buckets (id, name, public) values
  ('vehicle-photos', 'vehicle-photos', true),
  ('expense-receipts', 'expense-receipts', false),
  ('checklist-photos', 'checklist-photos', false),
  ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do nothing;

-- ==============================================================================
-- 14. INSERCIÓN DE DATOS INICIALES (EMPRESA + ADMIN + FLOTA)
-- ==============================================================================
do $$
declare
  v_company_id uuid;
  v_user_id uuid;
  v_v1 uuid;
  v_v2 uuid;
  v_v3 uuid;
begin
  -- A. Crear o asegurar la empresa principal Hally rentcar
  select id into v_company_id from public.companies where name = 'Hally rentcar' limit 1;
  if v_company_id is null then
    insert into public.companies (
      name, legal_name, phone, whatsapp_number, default_currency,
      timezone, grace_minutes, turnaround_minutes, pending_expiry_hours,
      tagline, address, delivery_zones, terms_text, public_enabled
    ) values (
      'Hally rentcar',
      'Hally Rent Car SRL',
      '809-555-0101',
      '18095550101',
      'DOP',
      'America/Santo_Domingo',
      59, 30, 72,
      'Tu rent a car de confianza en República Dominicana',
      'Av. Winston Churchill, Santo Domingo, D.N.',
      'Santo Domingo, Aeropuerto AILA, Santiago, Punta Cana',
      'Requisitos: Mayor de 21 años, cédula o pasaporte vigente y licencia de conducir física válida.',
      true
    ) returning id into v_company_id;
  else
    update public.companies
    set public_enabled = true,
        tagline = coalesce(tagline, 'Tu rent a car de confianza en República Dominicana'),
        whatsapp_number = coalesce(whatsapp_number, '18095550101')
    where id = v_company_id;
  end if;

  -- B. Crear usuario administrador en auth.users si no existe
  select id into v_user_id from auth.users where email = 'Robertoisaac170@gmail.com' limit 1;
  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'Robertoisaac170@gmail.com',
      crypt('Zaturno12071977', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Roberto Isaac"}',
      now(),
      now()
    );

    -- Identidad Supabase Auth
    insert into auth.identities (
      id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id,
      v_user_id,
      format('{"sub":"%s","email":"%s"}', v_user_id, 'Robertoisaac170@gmail.com')::jsonb,
      'email',
      now(),
      now(),
      now()
    ) on conflict (provider, id) do nothing;
  else
    -- Actualizar contraseña por si acaso estaba desactualizada
    update auth.users
    set encrypted_password = crypt('Zaturno12071977', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = '{"full_name":"Roberto Isaac"}'
    where id = v_user_id;
  end if;

  -- C. Asignar perfil y membresía de administrador
  insert into public.profiles (id, full_name, phone)
  values (v_user_id, 'Roberto Isaac', '809-555-0101')
  on conflict (id) do update set full_name = 'Roberto Isaac';

  insert into public.memberships (company_id, user_id, role, is_active)
  values (v_company_id, v_user_id, 'admin', true)
  on conflict (company_id, user_id) do update set role = 'admin', is_active = true;

  -- D. Asegurar permisos de roles
  perform app.seed_role_permissions(v_company_id);

  -- E. Insertar vehículos iniciales de muestra si no hay vehículos
  if not exists (select 1 from public.vehicles where company_id = v_company_id) then
    insert into public.vehicles (company_id, make, model, year, plate, transmission, fuel_type, seats, daily_rate, currency, features, description, is_active)
    values
      (v_company_id, 'Hyundai', 'Sonata LF', 2020, 'A928371', 'automatic', 'GLP / Gasolina', 5, 2800.00, 'DOP', '["Aire Acondicionado","Bluetooth","Cámara de reversa","Económico"]'::jsonb, 'Sedán espacioso y económico, perfecto para la ciudad.', true),
      (v_company_id, 'Honda', 'CR-V EX', 2021, 'G482910', 'automatic', 'Gasolina', 5, 4500.00, 'DOP', '["Apple CarPlay / Android Auto","Tracción Inteligente","Asientos de Cuero","Sunroof"]'::jsonb, 'SUV cómoda y familiar para viajes y aventuras por todo el país.', true),
      (v_company_id, 'Kia', 'K5 GT-Line', 2022, 'A102948', 'automatic', 'Gasolina', 5, 3800.00, 'DOP', '["Pantalla Táctil 10\"","Sensores de parqueo","Modo Sport","Diseño Ejecutivo"]'::jsonb, 'Sedán moderno, deportivo y elegante para clientes exigentes.', true);
  end if;

end $$;

-- Fase 2 / Migración 2: flota, clientes, bloqueos y reservas.
-- Aislamiento: claves foráneas compuestas (company_id, id) impiden referenciar datos de otra empresa.
-- ESTADO: escrita pero NO ejecutada.

-- ---------- vehicles ----------
create table public.vehicles (
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
  is_active boolean not null default true,   -- único estado manual; el resto se deriva de reservas/bloqueos
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, plate)
);
create trigger trg_vehicles_updated before update on public.vehicles
  for each row execute function app.set_updated_at();

-- ---------- customers ----------
create table public.customers (
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  check ((id_type is null) = (id_number is null))
);
-- Duplicado "seguro" solo por documento de identidad; el teléfono solo se indexa (puede repetirse).
create unique index customers_identity_uq on public.customers (company_id, id_type, id_number)
  where id_number is not null;
create index customers_phone_idx on public.customers (company_id, phone);
create trigger trg_customers_updated before update on public.customers
  for each row execute function app.set_updated_at();

-- ---------- vehicle_blocks (mantenimiento / bloqueo manual) ----------
create type public.block_kind as enum ('maintenance', 'manual');

create table public.vehicle_blocks (
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
  constraint vehicle_blocks_no_self_overlap
    exclude using gist (vehicle_id with =, period with &&)
);
create trigger trg_vehicle_blocks_updated before update on public.vehicle_blocks
  for each row execute function app.set_updated_at();

-- ---------- reservations ----------
create type public.reservation_status as enum
  ('pending','in_review','confirmed','in_progress','completed','rejected','cancelled');
create type public.reservation_channel as enum
  ('website','whatsapp','instagram','phone','referral','other_rental','other');

create table public.company_sequences (
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

create table public.reservations (
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
  period tstzrange not null,                  -- la calcula el trigger: [pickup_at, return_at + buffer)
  pickup_location text,
  return_location text,
  daily_rate numeric(12,2) not null check (daily_rate >= 0),
  billable_days int not null check (billable_days >= 1),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  extras_total numeric(12,2) not null default 0 check (extras_total >= 0),
  total_amount numeric(12,2) not null,
  currency text not null default 'DOP' check (currency in ('DOP','USD')),
  deposit_required numeric(12,2) not null default 0 check (deposit_required >= 0),
  expires_at timestamptz,                     -- solo para solicitudes pendientes; NO bloquea el vehículo
  internal_notes text,
  customer_message text,
  created_by uuid references auth.users(id),  -- null = solicitud pública
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, code),
  foreign key (company_id, customer_id) references public.customers (company_id, id) on delete restrict,
  foreign key (company_id, vehicle_id)  references public.vehicles  (company_id, id) on delete restrict,
  check (return_at > pickup_at),
  -- el total debe cuadrar exactamente con sus componentes (redondeo a 2 decimales, half up)
  check (total_amount = round(daily_rate * billable_days - discount_total + extras_total, 2)),
  check (total_amount >= 0),
  -- Dos reservas que BLOQUEAN no pueden solaparse (seguro ante concurrencia).
  constraint reservations_no_overlap
    exclude using gist (vehicle_id with =, period with &&)
    where (status in ('confirmed','in_progress'))
);
create index reservations_company_status_idx on public.reservations (company_id, status);
create index reservations_vehicle_period_idx on public.reservations using gist (vehicle_id, period);

-- Código legible por empresa y año: RC-2026-0001 (año en America/Santo_Domingo)
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
-- Nota: "code" es NOT NULL sin default; el trigger BEFORE INSERT lo rellena antes de validar la restricción (se puede omitir al insertar).
create trigger trg_reservations_before before insert or update on public.reservations
  for each row execute function app.reservations_before_write();
create trigger trg_reservations_updated before update on public.reservations
  for each row execute function app.set_updated_at();

-- Transiciones válidas de estado
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
    raise exception 'Transición de estado no permitida: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger trg_reservations_transition before update of status on public.reservations
  for each row execute function app.reservations_check_transition();

-- Historial de estados
create table public.reservation_status_history (
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
create index rsh_reservation_idx on public.reservation_status_history (reservation_id, created_at);

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
create trigger trg_reservations_log after insert or update on public.reservations
  for each row execute function app.reservations_log_status();

-- ---------- Solape ENTRE reservas bloqueantes y bloqueos (dos tablas => trigger + bloqueo de fila) ----------
create or replace function app.check_reservation_vs_blocks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('confirmed','in_progress') then
    perform 1 from public.vehicles where id = new.vehicle_id for update;  -- serializa por vehículo
    if exists (select 1 from public.vehicle_blocks b
               where b.vehicle_id = new.vehicle_id and b.period && new.period) then
      raise exception 'El vehículo está bloqueado (mantenimiento/bloqueo) en ese período'
        using errcode = 'exclusion_violation';
    end if;
  end if;
  return new;
end $$;
create trigger trg_reservations_vs_blocks after insert or update on public.reservations
  for each row execute function app.check_reservation_vs_blocks();

create or replace function app.blocks_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.period := tstzrange(new.starts_at, new.ends_at, '[)');
  perform 1 from public.vehicles where id = new.vehicle_id for update;
  if exists (select 1 from public.reservations r
             where r.vehicle_id = new.vehicle_id
               and r.status in ('confirmed','in_progress') and r.period && new.period) then
    raise exception 'Existen reservas confirmadas o en curso en ese período'
      using errcode = 'exclusion_violation';
  end if;
  return new;
end $$;
create trigger trg_blocks_before before insert or update on public.vehicle_blocks
  for each row execute function app.blocks_before_write();

-- ---------- Auditoría ----------
create trigger trg_audit_vehicles after insert or update or delete on public.vehicles
  for each row execute function app.audit_row();
create trigger trg_audit_customers after insert or update or delete on public.customers
  for each row execute function app.audit_row();
create trigger trg_audit_blocks after insert or update or delete on public.vehicle_blocks
  for each row execute function app.audit_row();
create trigger trg_audit_reservations after insert or update or delete on public.reservations
  for each row execute function app.audit_row();
create trigger trg_audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function app.audit_row();

-- Fase 2 / Migración 1: identidad, empresas, membresías, permisos y auditoría.
-- ESTADO: escrita pero NO ejecutada (sin Postgres en el entorno de redacción).
create extension if not exists btree_gist;
create extension if not exists pgcrypto;
create schema if not exists app;

create type public.user_role as enum ('admin', 'employee', 'accountant');

create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- companies ----------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  legal_name text,
  rnc text,                                    -- lo captura el propietario; no se inventa
  phone text,
  whatsapp_number text,
  default_currency text not null default 'DOP' check (default_currency in ('DOP','USD')),
  timezone text not null default 'America/Santo_Domingo',
  grace_minutes int not null default 59 check (grace_minutes >= 0),              -- SUPUESTO S2
  turnaround_minutes int not null default 0 check (turnaround_minutes >= 0),     -- SUPUESTO S3
  pending_expiry_hours int not null default 72 check (pending_expiry_hours > 0), -- SUPUESTO S4
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_companies_updated before update on public.companies
  for each row execute function app.set_updated_at();

-- ---------- profiles (1:1 con auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
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
create trigger trg_on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------- memberships ----------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id) where is_active;
create trigger trg_memberships_updated before update on public.memberships
  for each row execute function app.set_updated_at();

-- ---------- role_permissions (ajustables por empresa) ----------
create table public.role_permissions (
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
    ('admin','availability:write'),('admin','users:manage'),('admin','company:manage'),
    ('admin','audit:read'),
    ('employee','vehicles:read'),
    ('employee','customers:read'),('employee','customers:write'),
    ('employee','reservations:read'),('employee','reservations:write'),
    ('employee','availability:write')
    -- contador: sin permisos operativos en esta fase; recibirá finance:* y fiscal:* en Fases 4-5
  ) as r(role, permission)
  on conflict do nothing;
end $$;

create or replace function app.on_company_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform app.seed_role_permissions(new.id); return new; end $$;
create trigger trg_company_seed_permissions after insert on public.companies
  for each row execute function app.on_company_created();

-- ---------- helpers de autorización (usados por RLS) ----------
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

-- ---------- auditoría (solo inserción) ----------
create table public.audit_logs (
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
create index audit_logs_company_created_idx on public.audit_logs (company_id, created_at desc);

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

create trigger trg_audit_companies after insert or update or delete on public.companies
  for each row execute function app.audit_row();
create trigger trg_audit_memberships after insert or update or delete on public.memberships
  for each row execute function app.audit_row();

-- Bloque 5: web pública, protección del último administrador, documentos de vehículos, riesgo de clientes.
-- Aplicar con:  npx supabase migration up   (NO usar db reset).
-- ESTADO: escrita pero NO ejecutada.

-- ---------- datos públicos de la empresa ----------
alter table public.companies
  add column tagline text,
  add column address text,
  add column delivery_zones text,
  add column terms_text text,
  add column public_enabled boolean not null default true;

-- ---------- notas de riesgo en clientes ----------
alter table public.customers
  add column risk_flag boolean not null default false,
  add column risk_note text;

-- ---------- siempre debe quedar un administrador activo ----------
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
create trigger trg_protect_last_admin before update or delete on public.memberships
  for each row execute function app.protect_last_admin();

-- ---------- documentos de vehículos (seguro, matrícula, inspección) ----------
create table public.vehicle_documents (
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
create index vehicle_documents_vehicle_idx on public.vehicle_documents (vehicle_id);
create index vehicle_documents_expiry_idx on public.vehicle_documents (company_id, expires_on);
alter table public.vehicle_documents enable row level security;
create policy vdocs_select on public.vehicle_documents for select to authenticated using (app.has_permission(company_id, 'vehicles:read'));
create policy vdocs_insert on public.vehicle_documents for insert to authenticated with check (app.has_permission(company_id, 'vehicles:write'));
create policy vdocs_update on public.vehicle_documents for update to authenticated
  using (app.has_permission(company_id, 'vehicles:write')) with check (app.has_permission(company_id, 'vehicles:write'));
create policy vdocs_delete on public.vehicle_documents for delete to authenticated using (app.has_permission(company_id, 'vehicles:write'));
revoke all on public.vehicle_documents from anon;
create trigger trg_audit_vdocs after insert or update or delete on public.vehicle_documents for each row execute function app.audit_row();

insert into storage.buckets (id, name, public) values ('vehicle-documents', 'vehicle-documents', false) on conflict (id) do nothing;
create policy vdocs_files_select on storage.objects for select to authenticated
  using (bucket_id = 'vehicle-documents' and app.has_permission(app.path_company(name), 'vehicles:read'));
create policy vdocs_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicle-documents' and app.has_permission(app.path_company(name), 'vehicles:write'));

-- ---------- solicitudes públicas ----------
create table public.public_request_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  ip_hash text not null,
  phone text not null,
  created_at timestamptz not null default now()
);
create index public_request_log_ip_idx on public.public_request_log (ip_hash, created_at);
create index public_request_log_phone_idx on public.public_request_log (company_id, phone, created_at);
alter table public.public_request_log enable row level security;  -- sin políticas: solo la función definer

-- Crea el cliente (si no existe) y una reserva PENDIENTE desde la web. Solo la puede ejecutar el servidor (service_role).
-- Re-verifica disponibilidad, limita el abuso y nunca confirma nada.
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
revoke all on function public.create_public_request(uuid, uuid, timestamptz, timestamptz, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_public_request(uuid, uuid, timestamptz, timestamptz, text, text, text, text, text, text, text)
  to service_role;

-- ---------- solicitudes pendientes vencidas ----------
-- Rechaza las pendientes cuyo plazo expiró (solo las empresas donde el usuario puede escribir reservas).
create or replace function public.expire_pending_reservations() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.reservations r set status = 'rejected'
   where r.status = 'pending' and r.expires_at is not null and r.expires_at < now()
     and app.has_permission(r.company_id, 'reservations:write');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.expire_pending_reservations() from public, anon;
grant execute on function public.expire_pending_reservations() to authenticated;

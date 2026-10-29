-- Fase 2 / Migración 3: RLS en todas las tablas. Sin política = sin acceso.
-- Las tablas sin DELETE policy no permiten borrado desde el cliente (vehículos, clientes, reservas).
-- ESTADO: escrita pero NO ejecutada.

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
alter table public.company_sequences          enable row level security;  -- sin políticas: solo funciones definer

-- companies
create policy companies_select on public.companies for select to authenticated
  using (app.is_member(id));
create policy companies_update on public.companies for update to authenticated
  using (app.has_permission(id, 'company:manage'))
  with check (app.has_permission(id, 'company:manage'));

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.memberships mine
    join public.memberships theirs on theirs.company_id = mine.company_id
    where mine.user_id = auth.uid() and mine.is_active and theirs.user_id = profiles.id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- memberships / permisos
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or app.has_permission(company_id, 'users:manage'));
create policy memberships_write on public.memberships for all to authenticated
  using (app.has_permission(company_id, 'users:manage'))
  with check (app.has_permission(company_id, 'users:manage'));
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (app.is_member(company_id));
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (app.has_permission(company_id, 'users:manage'))
  with check (app.has_permission(company_id, 'users:manage'));

-- audit_logs: solo lectura con permiso; nadie escribe desde el cliente
create policy audit_select on public.audit_logs for select to authenticated
  using (app.has_permission(company_id, 'audit:read'));

-- vehicles
create policy vehicles_select on public.vehicles for select to authenticated
  using (app.has_permission(company_id, 'vehicles:read'));
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (app.has_permission(company_id, 'vehicles:write'));
create policy vehicles_update on public.vehicles for update to authenticated
  using (app.has_permission(company_id, 'vehicles:write'))
  with check (app.has_permission(company_id, 'vehicles:write'));

-- customers (datos personales: el contador no recibe customers:read por defecto)
create policy customers_select on public.customers for select to authenticated
  using (app.has_permission(company_id, 'customers:read'));
create policy customers_insert on public.customers for insert to authenticated
  with check (app.has_permission(company_id, 'customers:write'));
create policy customers_update on public.customers for update to authenticated
  using (app.has_permission(company_id, 'customers:write'))
  with check (app.has_permission(company_id, 'customers:write'));

-- vehicle_blocks
create policy blocks_select on public.vehicle_blocks for select to authenticated
  using (app.has_permission(company_id, 'vehicles:read'));
create policy blocks_insert on public.vehicle_blocks for insert to authenticated
  with check (app.has_permission(company_id, 'availability:write'));
create policy blocks_update on public.vehicle_blocks for update to authenticated
  using (app.has_permission(company_id, 'availability:write'))
  with check (app.has_permission(company_id, 'availability:write'));
create policy blocks_delete on public.vehicle_blocks for delete to authenticated
  using (app.has_permission(company_id, 'availability:write'));

-- reservations: confirmar/pasar a en curso exige reservations:confirm se valida en la capa de servicios
-- (RLS no distingue columnas; pendiente de endurecer con un RPC dedicado en Fase 3).
create policy reservations_select on public.reservations for select to authenticated
  using (app.has_permission(company_id, 'reservations:read'));
create policy reservations_insert on public.reservations for insert to authenticated
  with check (app.has_permission(company_id, 'reservations:write'));
create policy reservations_update on public.reservations for update to authenticated
  using (app.has_permission(company_id, 'reservations:write'))
  with check (app.has_permission(company_id, 'reservations:write'));

create policy rsh_select on public.reservation_status_history for select to authenticated
  using (app.has_permission(company_id, 'reservations:read'));

-- Privilegios: quitar todo a anon; authenticated solo lo que las políticas permitan
revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.audit_logs, public.reservation_status_history,
  public.company_sequences from authenticated;
revoke all on public.company_sequences from authenticated;

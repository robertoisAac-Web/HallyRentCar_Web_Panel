-- ============================================================================
-- Migración 8: Configuración Fiscal DGII (.p12, Ambiente) y Secuencias NCF/e-CF
-- ============================================================================

create table if not exists public.dgii_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  environment text not null default 'TesteCF'
    check (environment in ('TesteCF', 'CerteCF', 'eCF')),
  integration_mode text not null default 'direct_dgii'
    check (integration_mode in ('direct_dgii', 'psfe')),
  default_tax_rate numeric(5,2) not null default 18.00
    check (default_tax_rate >= 0 and default_tax_rate <= 100),
  auto_assign_sequence boolean not null default true,
  p12_file_name text,
  p12_base64 text,
  p12_password text,
  p12_uploaded_at timestamptz,
  psfe_provider text,
  psfe_api_url text,
  psfe_api_token text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.dgii_settings enable row level security;

drop policy if exists "dgii_settings_select" on public.dgii_settings;
create policy "dgii_settings_select" on public.dgii_settings
  for select to authenticated
  using (
    app.has_permission(company_id, 'payments:read') or app.has_permission(company_id, 'company:manage')
  );

drop policy if exists "dgii_settings_write" on public.dgii_settings;
create policy "dgii_settings_write" on public.dgii_settings
  for all to authenticated
  using (
    app.has_permission(company_id, 'company:manage') or app.has_permission(company_id, 'payments:write')
  )
  with check (
    app.has_permission(company_id, 'company:manage') or app.has_permission(company_id, 'payments:write')
  );

-- Inicializar configuración por defecto para las empresas existentes
insert into public.dgii_settings (company_id, environment, integration_mode, default_tax_rate, auto_assign_sequence)
select id, 'TesteCF', 'direct_dgii', 18.00, true
from public.companies
on conflict (company_id) do nothing;

-- Tabla de Secuencias Autorizadas de Comprobantes (NCF Serie B y e-CF Serie E)
create table if not exists public.dgii_sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fiscal_type text not null
    check (fiscal_type in ('B01', 'B02', 'B14', 'B15', 'E31', 'E32', 'E33', 'E34', 'E44', 'E45')),
  prefix text not null,
  padding_length integer not null default 10
    check (padding_length in (8, 10)),
  start_number bigint not null check (start_number >= 1),
  end_number bigint not null check (end_number >= start_number),
  current_number bigint not null check (current_number >= start_number - 1 and current_number <= end_number),
  expiration_date date,
  authorization_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_dgii_sequences_company_type
  on public.dgii_sequences (company_id, fiscal_type, is_active);

alter table public.dgii_sequences enable row level security;

drop policy if exists "dgii_sequences_select" on public.dgii_sequences;
create policy "dgii_sequences_select" on public.dgii_sequences
  for select to authenticated
  using (
    app.has_permission(company_id, 'payments:read') or app.has_permission(company_id, 'company:manage')
  );

drop policy if exists "dgii_sequences_write" on public.dgii_sequences;
create policy "dgii_sequences_write" on public.dgii_sequences
  for all to authenticated
  using (
    app.has_permission(company_id, 'company:manage') or app.has_permission(company_id, 'payments:write')
  )
  with check (
    app.has_permission(company_id, 'company:manage') or app.has_permission(company_id, 'payments:write')
  );

revoke all on public.dgii_settings, public.dgii_sequences from anon;

-- Función atómica para consumir el siguiente NCF / e-NCF autorizado de una secuencia activa
create or replace function public.consume_next_dgii_sequence(
  p_company_id uuid,
  p_fiscal_type text
)
returns table (
  ncf_or_ecf text,
  expiration_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq public.dgii_sequences%rowtype;
  v_auto boolean;
begin
  select auto_assign_sequence into v_auto
  from public.dgii_settings
  where company_id = p_company_id;

  if v_auto is false then
    return;
  end if;

  update public.dgii_sequences s
  set current_number = s.current_number + 1,
      is_active = case when s.current_number + 1 >= s.end_number then false else true end
  where s.id = (
    select q.id
    from public.dgii_sequences q
    where q.company_id = p_company_id
      and q.fiscal_type = p_fiscal_type
      and q.is_active = true
      and q.current_number < q.end_number
      and (q.expiration_date is null or q.expiration_date >= current_date)
    order by q.created_at asc
    limit 1
    for update skip locked
  )
  returning * into v_seq;

  if not found then
    return;
  end if;

  ncf_or_ecf := v_seq.prefix || lpad(v_seq.current_number::text, v_seq.padding_length, '0');
  expiration_date := v_seq.expiration_date;
  return next;
end;
$$;

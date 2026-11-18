-- ============================================================================
-- Migración 9: Activar Row-Level Security (RLS) en companies, memberships y profiles
-- ============================================================================

alter table public.companies enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;

revoke all on public.companies, public.memberships, public.profiles from anon;

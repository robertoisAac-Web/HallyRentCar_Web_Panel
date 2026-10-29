-- pgTAP bloque 5. ESTADO: escrita, NO EJECUTADA. Correr con: npx supabase test db
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a3','admin_a3@test.local'),
  ('00000000-0000-0000-0000-0000000000b3','admin_b3@test.local');
insert into companies (id, name, grace_minutes) values ('10000000-0000-0000-0000-0000000000a3','Empresa Pública', 59);
insert into memberships (company_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a3','admin'),
  ('10000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000b3','employee');
insert into vehicles (id, company_id, make, model, year, plate, daily_rate) values
  ('20000000-0000-0000-0000-0000000000a3','10000000-0000-0000-0000-0000000000a3','Honda','CR-V',2026,'PUB-1',3500);

-- Último administrador
select throws_ok($$ update memberships set role = 'employee' where user_id = '00000000-0000-0000-0000-0000000000a3' $$,
  '23514', null, 'no se puede degradar al último administrador');
select throws_ok($$ update memberships set is_active = false where user_id = '00000000-0000-0000-0000-0000000000a3' $$,
  '23514', null, 'no se puede desactivar al último administrador');
select lives_ok($$ update memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000000b3' $$, 'se puede promover a otro administrador');
select lives_ok($$ update memberships set role = 'employee' where user_id = '00000000-0000-0000-0000-0000000000a3' $$, 'con dos administradores se puede degradar a uno');

-- Solicitud pública
select matches(public.create_public_request('10000000-0000-0000-0000-0000000000a3','20000000-0000-0000-0000-0000000000a3',
  now() + interval '10 days', now() + interval '12 days', 'Cliente Web', '809-555-1234', null, 'Aeropuerto', null, 'Hola', 'iphash1'),
  '^RC-\d{4}-\d{4}$', 'la solicitud pública crea una reserva con código');
select is((select status::text from reservations where channel = 'website' limit 1), 'pending', 'la solicitud pública queda pendiente, nunca confirmada');
select is((select billable_days from reservations where channel = 'website' limit 1), 2, '2 días facturables para 48 h');

select throws_ok($$ select public.create_public_request('10000000-0000-0000-0000-0000000000a3','20000000-0000-0000-0000-0000000000a3',
  now() + interval '10 days', now() + interval '9 days', 'Cliente Web', '809-555-1234', null, null, null, null, 'iphash1') $$,
  'P0001', 'INVALID_DATES', 'rechaza fechas inválidas');

-- Límite de solicitudes por teléfono (3 por día)
select public.create_public_request('10000000-0000-0000-0000-0000000000a3','20000000-0000-0000-0000-0000000000a3', now() + interval '20 days', now() + interval '21 days', 'Cliente Web', '809-555-1234', null, null, null, null, 'iphash2');
select public.create_public_request('10000000-0000-0000-0000-0000000000a3','20000000-0000-0000-0000-0000000000a3', now() + interval '22 days', now() + interval '23 days', 'Cliente Web', '809-555-1234', null, null, null, null, 'iphash3');
select throws_ok($$ select public.create_public_request('10000000-0000-0000-0000-0000000000a3','20000000-0000-0000-0000-0000000000a3', now() + interval '24 days', now() + interval '25 days', 'Cliente Web', '809-555-1234', null, null, null, null, 'iphash4') $$,
  'P0001', 'RATE_LIMITED', 'limita las solicitudes repetidas del mismo teléfono');

select * from finish();
rollback;

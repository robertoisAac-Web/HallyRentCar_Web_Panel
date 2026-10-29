-- pgTAP. ESTADO: escrita, NO EJECUTADA. Correr con: supabase test db
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin_a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1','admin_b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1','empleado_a@test.local');
insert into companies (id, name) values
  ('10000000-0000-0000-0000-00000000000a','Empresa A'),
  ('10000000-0000-0000-0000-00000000000b','Empresa B');
insert into memberships (company_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000a1','admin'),
  ('10000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000b1','admin'),
  ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000c1','employee');
insert into vehicles (id, company_id, make, model, year, plate, daily_rate) values
  ('20000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','Honda','CR-V',2024,'TEST-A1',3500),
  ('20000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000b','Jeep','Grand Cherokee',2019,'TEST-B1',3000);
insert into customers (id, company_id, full_name) values
  ('30000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a','Cliente A');

-- Reserva 1 confirmada: 10:00 -> 10:00 (3 días)
insert into reservations (company_id, customer_id, vehicle_id, status, channel, pickup_at, return_at,
                          daily_rate, billable_days, total_amount) values
 ('10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a',
  'confirmed','phone','2026-12-01 14:00+00','2026-12-04 14:00+00',3500,3,10500);

select throws_ok($$ insert into reservations (company_id, customer_id, vehicle_id, status, channel, pickup_at, return_at, daily_rate, billable_days, total_amount) values
 ('10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a','confirmed','phone','2026-12-03 14:00+00','2026-12-05 14:00+00',3500,2,7000) $$,
 '23P01', null, 'rechaza solape de dos reservas confirmadas');

select lives_ok($$ insert into reservations (company_id, customer_id, vehicle_id, status, channel, pickup_at, return_at, daily_rate, billable_days, total_amount) values
 ('10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a','confirmed','phone','2026-12-04 14:00+00','2026-12-06 14:00+00',3500,2,7000) $$,
 'permite reserva consecutiva exacta (devolución = recogida)');

select lives_ok($$ insert into reservations (company_id, customer_id, vehicle_id, status, channel, pickup_at, return_at, daily_rate, billable_days, total_amount) values
 ('10000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a','pending','website','2026-12-02 14:00+00','2026-12-03 14:00+00',3500,1,3500) $$,
 'una solicitud pendiente NO bloquea ni es bloqueada');

select throws_ok($$ insert into vehicle_blocks (company_id, vehicle_id, kind, starts_at, ends_at) values
 ('10000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a','maintenance','2026-12-02 00:00+00','2026-12-02 23:00+00') $$,
 '23P01', null, 'no se puede bloquear mantenimiento sobre una reserva confirmada');

select throws_ok($$ insert into reservations (company_id, customer_id, vehicle_id, channel, pickup_at, return_at, daily_rate, billable_days, total_amount) values
 ('10000000-0000-0000-0000-00000000000b','30000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000b','phone','2026-12-10 14:00+00','2026-12-11 14:00+00',3000,1,3000) $$,
 '23503', null, 'FK compuesta impide mezclar cliente de empresa A con vehículo de empresa B');

select throws_ok($$ update reservations set status = 'in_progress' where status = 'pending' $$,
 '23514', null, 'pendiente no puede pasar directo a en curso');

-- RLS: admin de B no ve datos de A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1"}';
select is((select count(*)::int from vehicles), 1, 'admin B solo ve su vehículo');
select is((select count(*)::int from customers), 0, 'admin B no ve clientes de A');

-- RLS: empleado A no puede leer auditoría
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1"}';
select is((select count(*)::int from audit_logs), 0, 'empleado no lee audit_logs');

select * from finish();
rollback;

-- pgTAP Fase 4. ESTADO: escrita, NO EJECUTADA. Correr con: npx supabase test db
begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2','admin_a2@test.local'),
  ('00000000-0000-0000-0000-0000000000c2','empleado_a2@test.local'),
  ('00000000-0000-0000-0000-0000000000d2','contador_a2@test.local');
insert into companies (id, name) values ('10000000-0000-0000-0000-0000000000a2','Empresa Dinero');
insert into memberships (company_id, user_id, role) values
  ('10000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a2','admin'),
  ('10000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000c2','employee'),
  ('10000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000d2','accountant');
insert into vehicles (id, company_id, make, model, year, plate, daily_rate) values
  ('20000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000a2','Honda','CR-V',2025,'MONEY-1',3500);
insert into customers (id, company_id, full_name) values
  ('30000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000a2','Cliente Dinero');
insert into reservations (id, company_id, customer_id, vehicle_id, status, channel, pickup_at, return_at, daily_rate, billable_days, total_amount) values
  ('40000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000a2','30000000-0000-0000-0000-0000000000a2','20000000-0000-0000-0000-0000000000a2',
   'confirmed','phone','2027-01-10 14:00+00','2027-01-12 14:00+00',3500,2,7000);

insert into payments (id, company_id, reservation_id, kind, method, amount, currency) values
  ('50000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000a2','40000000-0000-0000-0000-0000000000a2','advance','cash',3000,'DOP');

select throws_ok($$ insert into payments (company_id, reservation_id, kind, method, amount, currency, reference) values
  ('10000000-0000-0000-0000-0000000000a2','40000000-0000-0000-0000-0000000000a2','payment','transfer',100,'DOP',null) $$,
  '23514', null, 'transferencia sin referencia se rechaza');

select throws_ok($$ insert into payments (company_id, reservation_id, kind, method, amount, currency) values
  ('10000000-0000-0000-0000-0000000000a2','40000000-0000-0000-0000-0000000000a2','payment','cash',100,'USD') $$,
  '23514', null, 'la moneda del pago debe coincidir con la de la reserva');

select throws_ok($$ insert into payments (company_id, reservation_id, kind, method, amount, currency) values
  ('10000000-0000-0000-0000-0000000000a2','40000000-0000-0000-0000-0000000000a2','refund','cash',3500,'DOP') $$,
  '23514', null, 'un reembolso no puede superar lo cobrado');

select lives_ok($$ insert into payments (company_id, reservation_id, kind, method, amount, currency) values
  ('10000000-0000-0000-0000-0000000000a2','40000000-0000-0000-0000-0000000000a2','refund','cash',1000,'DOP') $$,
  'un reembolso dentro de lo cobrado se permite');

select throws_ok($$ update payments set amount = 1 where id = '50000000-0000-0000-0000-0000000000a2' $$,
  '23514', null, 'un pago no se puede editar');

-- Depósito: no se devuelve más de lo recibido; la deducción exige justificación
insert into deposit_movements (company_id, reservation_id, kind, method, amount, currency) values
  ('10000000-0000-0000-0000-0000000000a2','40000000-0000-0000-0000-0000000000a2','received','cash',5000,'DOP');
select throws_ok($$ insert into deposit_movements (company_id, reservation_id, kind, method, amount, currency) values
  ('10000000-0000-0000-0000-0000000000a2','40000000-0000-0000-0000-0000000000a2','returned','cash',6000,'DOP') $$,
  '23514', null, 'no se devuelve más depósito del recibido');
select throws_ok($$ insert into deposit_movements (company_id, reservation_id, kind, amount, currency) values
  ('10000000-0000-0000-0000-0000000000a2','40000000-0000-0000-0000-0000000000a2','applied',500,'DOP') $$,
  '23514', null, 'una deducción sin justificación se rechaza');
select lives_ok($$ insert into deposit_movements (company_id, reservation_id, kind, amount, currency, note) values
  ('10000000-0000-0000-0000-0000000000a2','40000000-0000-0000-0000-0000000000a2','applied',500,'DOP','Rayón en el parachoques') $$,
  'deducción justificada se permite');

-- RLS por rol
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2"}';
select is((select count(*)::int from payments), 2, 'el empleado ve los pagos de su empresa');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2"}';
select is((select count(*)::int from customers), 0, 'el contador no ve clientes');

select * from finish();
rollback;

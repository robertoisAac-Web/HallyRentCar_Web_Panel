begin;
delete from payments where reservation_id = (select id from reservations where code = 'RC-2026-0001');
delete from reservation_charges where reservation_id = (select id from reservations where code = 'RC-2026-0001');
delete from deposit_movements where reservation_id = (select id from reservations where code = 'RC-2026-0001');
delete from rental_checklists where reservation_id = (select id from reservations where code = 'RC-2026-0001');
delete from reservation_status_history where reservation_id = (select id from reservations where code = 'RC-2026-0001');
delete from reservations where code = 'RC-2026-0001';
commit;
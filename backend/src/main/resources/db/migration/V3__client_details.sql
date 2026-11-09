-- Structured client fields. Legacy data kept phone numbers, towns and markets inside name/address;
-- V4 copies the phone numbers it can recognise into the new phone column.
alter table client add column phone varchar(100);
alter table client add column city varchar(255);
alter table client add column note varchar(1000);
-- Debt carried over from before payments were tracked here, entered by hand per client
alter table client add column opening_debt numeric(14, 2) not null default 0;

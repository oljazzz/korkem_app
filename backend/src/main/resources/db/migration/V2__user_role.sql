-- User roles: ADMIN manages users and may delete records; MANAGER does day-to-day work.
-- Every user that existed before roles had full access, so they become ADMIN.
alter table app_user add column role varchar(20) not null default 'MANAGER';
update app_user set role = 'ADMIN';

-- token_version: part of every JWT; raising it signs the user out on every device
-- (password change, "sign out everywhere"). must_change_password: set when an admin creates the
-- user or resets their password, so only the user ever knows it.
alter table app_user
    add column token_version        integer not null default 0,
    add column must_change_password boolean not null default false,
    add column password_changed_at  timestamp with time zone;

-- Where the request came from. Failed logins are counted from here, so throttling survives restarts.
alter table audit_log add column ip varchar(45);

create index audit_log_failed_login_user_idx on audit_log (lower(username), at desc) where action = 'LOGIN_FAILED';
create index audit_log_failed_login_ip_idx on audit_log (ip, at desc) where action = 'LOGIN_FAILED';
create index audit_log_login_user_idx on audit_log (lower(username), at desc) where action = 'LOGIN';

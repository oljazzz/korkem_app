-- Who changed what and when. Append-only: a trigger rejects every update, delete and truncate,
-- so the application (or anyone with its database user) cannot rewrite history.
create table audit_log (
    id           bigserial primary key,
    at           timestamp with time zone not null,
    username     varchar(100),
    action       varchar(20)  not null,
    entity_type  varchar(30)  not null,
    entity_id    bigint,
    -- How the record was called at the time ("№ 7283", a client's name): readable after it is deleted
    entity_label varchar(255),
    -- {"field": {"old": …, "new": …}}; a created record has only "new", a deleted one only "old".
    -- json, not jsonb: it keeps the fields in the order they were written, which is the order shown
    changes      json         not null,
    trace_id     varchar(32)
);

create index audit_log_at_idx on audit_log (at desc, id desc);
create index audit_log_entity_idx on audit_log (entity_type, entity_id, at desc);
create index audit_log_username_idx on audit_log (lower(username), at desc);

create function audit_log_append_only() returns trigger language plpgsql as $$
begin
    raise exception 'audit_log is append-only';
end
$$;

create trigger audit_log_no_update_delete before update or delete on audit_log
    for each row execute function audit_log_append_only();
create trigger audit_log_no_truncate before truncate on audit_log
    for each statement execute function audit_log_append_only();

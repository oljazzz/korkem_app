-- Organization details printed on documents, editable by administrators.
-- A single row (id = 1); until it exists the app falls back to app.company in application.yml.
create table company_settings (
    id                 bigint primary key,
    name               varchar(255) not null,
    bin                varchar(12),
    address            varchar(500),
    phone              varchar(100),
    chief_accountant   varchar(255),
    release_allowed_by varchar(255),
    updated_at         timestamp with time zone,
    updated_by         varchar(100)
);

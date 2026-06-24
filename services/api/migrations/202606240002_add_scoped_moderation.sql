-- +goose Up
create table domain_owners (
    domain_id bigint not null references domains(id),
    user_id bigint not null references users(id),
    created_at timestamptz not null default now(),
    primary key (domain_id, user_id)
);

create index domain_owners_user_idx on domain_owners(user_id, domain_id);

create table module_moderators (
    module_id bigint not null references modules(id),
    user_id bigint not null references users(id),
    created_at timestamptz not null default now(),
    primary key (module_id, user_id)
);

create index module_moderators_user_idx on module_moderators(user_id, module_id);

-- +goose Down
drop index if exists module_moderators_user_idx;
drop table if exists module_moderators;
drop index if exists domain_owners_user_idx;
drop table if exists domain_owners;

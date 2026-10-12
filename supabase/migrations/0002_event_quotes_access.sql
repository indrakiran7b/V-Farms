-- Event quote customer access and versioning (extends 0001_init.sql)

alter table properties
  add column if not exists max_event_attendance int not null default 120,
  add column if not exists event_capacity_awaiting_owner_approval boolean not null default true;

alter table event_quotes
  add column if not exists version int not null default 1,
  add column if not exists access_token text not null default encode(gen_random_bytes(24), 'hex'),
  add column if not exists supersedes_quote_id text references event_quotes(id),
  add column if not exists balance_paise bigint not null default 0,
  add column if not exists security_deposit_paise bigint not null default 0,
  add column if not exists cancellation_terms text not null default 'Draft — awaiting owner approval',
  add column if not exists declined_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists accepted_at timestamptz;

create unique index if not exists event_quotes_access_token_idx on event_quotes (access_token);

create table if not exists event_categories (
  id text primary key,
  property_id text not null references properties(id),
  label text not null,
  description text not null default '',
  published boolean not null default false,
  awaiting_owner_approval boolean not null default true
);

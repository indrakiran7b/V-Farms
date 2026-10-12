alter table inventory_blocks
  add column if not exists reason text,
  add column if not exists internal_notes text,
  add column if not exists created_by_actor_id text references admin_users(id);

comment on column inventory_blocks.reason is 'Required for maintenance/admin closures';
comment on column inventory_blocks.internal_notes is 'Staff-only notes for operational blocks';

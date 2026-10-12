alter table stays
  add column if not exists customer_access_token text;

alter table event_enquiries
  add column if not exists customer_access_token text;

create unique index if not exists stays_customer_access_token on stays (customer_access_token)
  where customer_access_token is not null;

create unique index if not exists event_enquiries_customer_access_token on event_enquiries (customer_access_token)
  where customer_access_token is not null;

alter table notifications
  add column if not exists html text,
  add column if not exists idempotency_key text;

create unique index if not exists notifications_idempotency_sent on notifications (idempotency_key)
  where idempotency_key is not null and status = 'sent';

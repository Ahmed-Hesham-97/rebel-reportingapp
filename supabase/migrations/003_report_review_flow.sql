-- Reports are now reviewed internally before delivery. A snapshot holds the
-- sections chosen for the client PDF, and delivered_at records the moment the
-- team actually sent it. Clients remember the last selection as their default.

alter table public.report_snapshots
  add column included_sections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(included_sections) = 'array'),
  add column delivered_at timestamptz;

alter table public.clients
  add column default_sections jsonb not null default '[]'::jsonb
    check (jsonb_typeof(default_sections) = 'array');

create index snapshots_awaiting_review_idx
  on public.report_snapshots(client_id)
  where delivered_at is null;

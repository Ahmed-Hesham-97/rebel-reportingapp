-- Support multi-month / quarter reports keyed by [start, end).
alter table public.report_snapshots
  add column if not exists period_end date;

update public.report_snapshots
set period_end = (report_month + interval '1 month')::date
where period_end is null;

alter table public.report_snapshots
  alter column period_end set not null;

alter table public.report_snapshots
  drop constraint if exists report_snapshots_client_id_report_month_key;

alter table public.report_snapshots
  add constraint report_snapshots_client_period_key unique (client_id, report_month, period_end);

create index if not exists snapshots_client_period_idx
  on public.report_snapshots(client_id, report_month desc, period_end desc);

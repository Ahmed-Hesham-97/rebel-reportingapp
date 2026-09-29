-- Manual channel content that cannot be pulled from Shopify / Meta / Klaviyo.
-- Filled in on the report review page and merged into the client PDF.

alter table public.report_snapshots
  add column manual_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(manual_data) = 'object');

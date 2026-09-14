create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'viewer');
create type public.report_status as enum ('pending', 'processing', 'partial', 'completed', 'failed');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  hashed_password text not null,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  brand_logo_url text,
  shopify_store_url text not null,
  shopify_access_token text not null,
  klaviyo_api_key text not null,
  meta_access_token text not null,
  meta_ad_account_id text not null,
  report_recipients jsonb not null default '[]'::jsonb check (jsonb_typeof(report_recipients) = 'array'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  report_month date not null,
  shopify_data jsonb,
  klaviyo_data jsonb,
  meta_data jsonb,
  pdf_url text,
  status public.report_status not null default 'pending',
  error_log text,
  created_at timestamptz not null default now(),
  unique (client_id, report_month)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index clients_active_idx on public.clients(is_active);
create index snapshots_client_month_idx on public.report_snapshots(client_id, report_month desc);
create index activity_client_created_idx on public.activity_logs(client_id, created_at desc);

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.report_snapshots enable row level security;
alter table public.activity_logs enable row level security;

-- The browser never receives the Supabase key. NextAuth authorizes server routes,
-- while the server-only service client performs the application queries.

insert into storage.buckets (id, name, public) values ('report-pdfs', 'report-pdfs', false)
on conflict (id) do nothing;

create policy "No anonymous report PDF access"
  on storage.objects for all to anon using (false) with check (false);

create policy "No authenticated browser report PDF access"
  on storage.objects for all to authenticated using (false) with check (false);

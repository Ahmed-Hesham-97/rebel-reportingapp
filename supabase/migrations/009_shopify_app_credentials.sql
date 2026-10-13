-- Each client store needs its own Shopify Dev Dashboard app (custom distribution).
-- Store that app's Client ID (public) and Client secret (encrypted) on the client
-- so OAuth does not depend on a single global SHOPIFY_CLIENT_* pair.

alter table public.clients
  add column if not exists shopify_app_client_id text,
  add column if not exists shopify_app_client_secret text;

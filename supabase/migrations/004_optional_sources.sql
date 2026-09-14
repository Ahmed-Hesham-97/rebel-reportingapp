-- Clients can be onboarded with Shopify alone. Klaviyo and Meta credentials are
-- added later, and reports simply omit the sections for sources not configured.

alter table public.clients
  alter column klaviyo_api_key drop not null,
  alter column meta_access_token drop not null,
  alter column meta_ad_account_id drop not null;

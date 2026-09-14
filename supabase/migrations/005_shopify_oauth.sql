-- Shopify tokens now arrive through the OAuth callback rather than being pasted
-- in, so a client exists before it has a token.

alter table public.clients
  alter column shopify_access_token drop not null;

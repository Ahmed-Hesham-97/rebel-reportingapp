# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Next.js App Router foundation with strict TypeScript, Tailwind CSS, and accessible UI primitives.
- NextAuth credentials login with role-aware internal access.
- Supabase migrations, RLS, encrypted client credentials, client CRUD, and audit logging.
- Shopify, Klaviyo, and Meta server-side adapters with retries and structured request logging.
- Monthly report generation, partial-source handling, PDF rendering, private Storage upload, Resend delivery, and Vercel Cron configuration.
- Live client dashboard, report history, executive summary, and month-over-month metric types.
- Storefront funnel section sourced from ShopifyQL: sessions, visitors, add-to-cart rate, conversion rate, checkout conversion, and bounce rate, with month-over-month comparison and breakdowns by traffic source and device.
- Store changes section listing product, collection, and content events for the period plus the live theme's last update date.
- Internal review step: reports are generated for the team first, who then pick the client-facing sections from a checkbox list, preview the PDF, and send it explicitly. Selections are remembered per client.

- Shopify OAuth: an install route and callback that verify the state nonce and request HMAC, exchange the authorization code for an offline token, and store it encrypted against the client. Replaces manual token entry, which Shopify discontinued for new apps.

### Changed

- Report generation and the monthly cron no longer email clients automatically; delivery is an explicit admin action.
- Dropped the unused `customer` field from the Shopify orders query, removing the `read_customers` scope and its protected customer data requirement.
- Klaviyo and Meta credentials are optional, so a client can be onboarded with Shopify alone. Unconnected sources are skipped during generation instead of being reported as failures, and their sections are hidden from the picker.
- The PDF route now previews without uploading or overwriting the stored file, and section numbering was removed so omitted sections don't leave gaps.

### Fixed

- Grant table privileges to the Supabase service role and revoke them from browser-facing roles, so server-side queries no longer fail with "permission denied".

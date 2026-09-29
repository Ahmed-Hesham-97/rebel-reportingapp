# Rebel Reports

Rebel Reports is an internal reporting workspace for Rebel Marketing. It combines Shopify, Klaviyo, and Meta Ads data into monthly snapshots, branded PDF reports, and client delivery emails.

## Local setup

1. Install Node.js 22 LTS (the current dependency set does not support Node 23).
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in every server-only value.
4. Apply the migrations in `supabase/migrations/` in numeric order, from `001_initial_schema.sql` through `007_manual_report_data.sql`.
5. Create an account at `/signup` with a `@rebelmarketingcafe.com` email (or seed one with `npm run create-user -- you@rebelmarketingcafe.com '<password>' admin`).
6. Run `npm run dev`.

Only `@rebelmarketingcafe.com` emails can sign up or sign in.

`SUPABASE_SERVICE_KEY`, `ENCRYPTION_KEY`, `RESEND_API_KEY`, and client credentials must never be exposed as `NEXT_PUBLIC_*` variables or sent to client components.

## Data model

- `clients` stores encrypted Shopify, Klaviyo, and Meta secrets and validated report recipients.
- `report_snapshots` stores each client/month exactly once and supports `pending`, `processing`, `partial`, `completed`, and `failed` states.
- `activity_logs` stores sanitized report and client events.
- The `report-pdfs` Storage bucket is private; PDF routes generate authorized responses.

The app uses NextAuth as the authentication authority. Supabase RLS is enabled and browser access is denied; authenticated server routes use the server-only Supabase service client after checking the NextAuth role.

## Source permissions

Only Shopify is required to onboard a client. Klaviyo and Meta can be added later from client settings; until then their report sections are hidden from the picker and skipped during generation rather than counting as failures.

- Shopify: connected over OAuth, not by pasting a token. Shopify no longer allows new admin-created custom apps, so create one app per client store in the [Dev Dashboard](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps), choose Custom distribution, and set `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`. Requested scopes live in `src/lib/integrations/shopify-oauth.ts`: `read_orders`, `read_customers`, `read_products`, `read_reports` (storefront funnel), and `read_themes` (live theme status). The app's redirect URI must be `<NEXTAUTH_URL>/api/shopify/callback`.
- Klaviyo: a private API key with account, campaign, flow, profile, and reporting scopes as available in the client account.
- Meta: a system-user token with access to the client ad account and read-insights permission.

The adapters normalize unavailable metrics to `null` instead of guessing. Shopify store timezone is fetched from the Admin API before report ranges are calculated. Report months are first-of-month dates for the previous calendar month.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The monthly cron endpoint is protected by `Authorization: Bearer $CRON_SECRET` and is configured in `vercel.json` for 09:00 UTC on the second day of each month.

## Review before delivery

Generating a report pulls Shopify (required) plus Klaviyo / Meta when connected. Anything the Rebel monthly template needs that APIs cannot supply — social organic, Google Ads, influencer, content, GBP, website notes — is entered on the report page under **Manual report fields**. Saving those fields and downloading the PDF merges pulled + manual data into one client document.

Sections follow the [Rebel Marketing Monthly Report template](https://docs.google.com/document/d/1qm3ZCn336DZJiv-8KdEJOw5ZJlpDob8wi0bKA8ZmsD8/edit?usp=sharing): Social, Paid Media, Website, Email & SMS, Influencer & UGC, Content Creation, Google Business, and Summary.

Apply migration `007_manual_report_data.sql` so `report_snapshots.manual_data` exists before saving manual fields.

Shopify OAuth scopes: `read_orders`, `read_customers`, `read_products`, `read_reports`, `read_themes`. Reconnect each store after deploying so `read_customers` is granted (new/returning customer counts).

Only admins can send. The chosen sections are saved on the snapshot and become the client's default for the following month. Sections live in `src/lib/reports/sections.ts`, which the picker UI and the PDF both read, so adding a section means editing one list.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

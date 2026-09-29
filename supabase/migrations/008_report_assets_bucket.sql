-- Public assets for report screenshots (e.g. top performing content).
-- Uploads go through authenticated API routes using the service role;
-- public read lets @react-pdf/renderer fetch images when rendering PDFs.

insert into storage.buckets (id, name, public)
values ('report-assets', 'report-assets', true)
on conflict (id) do nothing;

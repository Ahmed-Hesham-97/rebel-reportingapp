-- The app authorizes every request through NextAuth and reaches Postgres only
-- with the server-only service role. Browser-facing roles get no privileges.

grant usage on schema public to service_role;

grant all privileges on table
  public.users,
  public.clients,
  public.report_snapshots,
  public.activity_logs
to service_role;

revoke all privileges on table
  public.users,
  public.clients,
  public.report_snapshots,
  public.activity_logs
from anon, authenticated;

import { AppShell } from "@/components/layout/app-shell";

// Protected pages hit Supabase at request time. Without this, Next tries to
// prerender /dashboard during `next build` (especially when AUTH_DISABLED),
// and the build fails when the DB isn't reachable from the build machine.
export const dynamic = "force-dynamic";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

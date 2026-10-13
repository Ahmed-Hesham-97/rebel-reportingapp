import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="font-display text-3xl font-bold tracking-tight text-[var(--ink)]">Rebel Reports</p>
          <p className="mt-2 text-sm text-slate-500">Enter the access password to continue.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

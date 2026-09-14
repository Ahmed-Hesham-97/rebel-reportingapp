import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { COMPANY_EMAIL_DOMAIN } from "@/lib/auth/company-email";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-red-500 text-2xl font-black">R</div>
          <h1 className="text-3xl font-bold tracking-tight">Create account</h1>
          <p className="mt-2 text-sm text-slate-400">Use your @{COMPANY_EMAIL_DOMAIN} work email</p>
        </div>
        <SignupForm />
      </div>
    </main>
  );
}

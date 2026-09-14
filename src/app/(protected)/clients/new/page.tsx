import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { ClientForm } from "@/components/clients/client-form";

export default async function NewClientPage() {
  await requireAdmin();
  return <div className="p-6 lg:p-10"><div className="mx-auto max-w-3xl">
    <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16} /> Back to dashboard</Link>
    <h1 className="text-3xl font-bold tracking-tight">Add a client</h1><p className="mb-8 mt-2 text-slate-500">Connect the store and marketing channels for automated monthly reporting.</p>
    <ClientForm />
  </div></div>;
}

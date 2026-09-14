import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { getClient } from "@/lib/db";
import { ClientForm } from "@/components/clients/client-form";
import { ConnectionTest } from "@/components/clients/connection-test";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClientSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  return <div className="p-6 lg:p-10"><div className="mx-auto max-w-3xl">
    <Link href={`/clients/${id}`} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft size={16} /> Back to client</Link>
    <h1 className="text-3xl font-bold tracking-tight">Client settings</h1><p className="mb-8 mt-2 text-slate-500">Update connection details for {client.name}. Existing secrets stay unchanged unless replaced.</p>
    <Card className="mb-6"><CardHeader><CardTitle>Connect the Shopify store</CardTitle><p className="text-sm text-slate-500">Sends the store owner through Shopify&apos;s approval screen and stores the resulting token encrypted. Use this instead of pasting a token by hand.</p></CardHeader><CardContent><Button asChild><a href={`/api/shopify/install?clientId=${client.id}`}>Connect with Shopify</a></Button></CardContent></Card>
    <ClientForm clientId={client.id} initialValues={{ name: client.name, brandLogoUrl: client.brand_logo_url ?? "", shopifyStoreUrl: client.shopify_store_url, metaAdAccountId: client.meta_ad_account_id ?? "", reportRecipients: client.report_recipients.join(", ") }} />
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <ConnectionTest clientId={client.id} source="shopify" />
      <ConnectionTest clientId={client.id} source="klaviyo" />
      <ConnectionTest clientId={client.id} source="meta" />
    </div>
  </div></div>;
}

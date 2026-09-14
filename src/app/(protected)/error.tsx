"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ProtectedError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="grid min-h-screen place-items-center p-6"><div className="max-w-md text-center"><h1 className="text-2xl font-bold">Something went wrong</h1><p className="mt-2 text-sm text-slate-500">We couldn&apos;t load this workspace. Try again or return to the dashboard.</p><Button className="mt-6" onClick={reset}>Try again</Button></div></main>;
}

import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center p-6 text-center"><div><p className="text-sm font-semibold text-red-500">404</p><h1 className="mt-2 text-3xl font-bold">Page not found</h1><p className="mt-2 text-slate-500">The report or client you requested does not exist.</p><Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-red-500 hover:underline">Back to dashboard</Link></div></main>;
}

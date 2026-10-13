"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    // Full navigation after credentials sign-in so the session cookie is
    // included on the next server render (soft client navigations can race).
    const result = await signIn("credentials", {
      password: String(formData.get("password") ?? ""),
      redirect: false,
      callbackUrl: "/dashboard",
    });
    if (!result?.ok) {
      setPending(false);
      setError("Incorrect password.");
      return;
    }
    window.location.assign(result.url ?? "/dashboard");
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form action={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-start px-2 text-xs text-stone-400 hover:bg-white/10 hover:text-white"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </Button>
  );
}

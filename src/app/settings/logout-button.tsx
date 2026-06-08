"use client";

import { useState } from "react";
import { ChevronRight, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className="flex h-[54px] w-full min-w-0 items-center gap-3 rounded-lg border border-destructive/25 bg-card px-4 text-left text-destructive shadow-[0_8px_24px_rgba(13,13,20,0.035)] transition-colors hover:border-destructive/45 hover:bg-destructive/5 disabled:pointer-events-none disabled:opacity-60"
      onClick={async () => {
        setPending(true);
        await signOut({ callbackUrl: "/sign-in" });
      }}
    >
      <LogOut className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs font-black">
        {pending ? "Logging out..." : "Log out"}
      </span>
      <ChevronRight className="size-4 shrink-0" />
    </button>
  );
}

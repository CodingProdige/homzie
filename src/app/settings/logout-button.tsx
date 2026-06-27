"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, LogOut, X } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          disabled={pending}
          className="flex h-[54px] w-full min-w-0 items-center gap-3 rounded-lg border border-destructive/25 bg-card px-4 text-left text-destructive shadow-[0_8px_24px_rgba(13,13,20,0.035)] transition-colors hover:border-destructive/45 hover:bg-destructive/5 disabled:pointer-events-none disabled:opacity-60"
        >
          <LogOut className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
            {pending ? "Logging out..." : "Log out"}
          </span>
          <ChevronRight className="size-4 shrink-0" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 z-[91] max-h-[calc(100dvh-2rem)] -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl outline-none sm:left-1/2 sm:right-auto sm:w-[min(92vw,26rem)] sm:-translate-x-1/2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Log out</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                You&apos;ll be signed out on this device and returned to the sign-in screen.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-background text-foreground"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">
                Stay signed in
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                await signOut({ callbackUrl: "/sign-in" });
              }}
            >
              Log out
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

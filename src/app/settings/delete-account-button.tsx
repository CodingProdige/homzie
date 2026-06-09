"use client";

import { useState, useTransition, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, Loader2, Trash2, X } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { softDeleteCurrentAccount } from "./account-actions";

function DialogShell({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm" />
      <Dialog.Content className="fixed inset-x-4 top-1/2 z-[91] max-h-[calc(100dvh-2rem)] -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl outline-none sm:left-1/2 sm:right-auto sm:w-[min(92vw,28rem)] sm:-translate-x-1/2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="text-lg font-black">{title}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
              {description}
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
        <div className="mt-5">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"intro" | "confirm">("intro");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setStep("intro");
          setConfirmed(false);
          setError("");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex h-[54px] w-full min-w-0 items-center gap-3 rounded-lg border border-destructive/25 bg-card px-4 text-left text-destructive shadow-[0_8px_24px_rgba(13,13,20,0.035)] transition-colors hover:border-destructive/45 hover:bg-destructive/5"
        >
          <Trash2 className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs font-black">Delete account</span>
          <ChevronRight className="size-4 shrink-0" />
        </button>
      </Dialog.Trigger>
      {step === "intro" ? (
        <DialogShell
          title="Delete account"
          description="This action is permanent. You will lose access to your profile, listings, reels, saved items, billing history, and account settings."
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-sm font-semibold leading-6 text-foreground">
                Once you delete your account, you will be signed out immediately and this cannot be undone.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Keep account
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setError("");
                  setStep("confirm");
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : (
        <DialogShell
          title="Are you 100% sure?"
          description="Deleting your account is final. Please confirm one more time before continuing."
        >
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 size-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm font-semibold leading-6 text-foreground">
                I understand that deleting my account is permanent and I will lose access to everything connected to it.
              </span>
            </label>
            {error ? (
              <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("");
                  setStep("intro");
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!confirmed || isPending}
                onClick={() => {
                  setError("");
                  startTransition(async () => {
                    const result = await softDeleteCurrentAccount();

                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }

                    await signOut({ callbackUrl: "/sign-in" });
                  });
                }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Deleting account...
                  </>
                ) : (
                  "Delete account"
                )}
              </Button>
            </div>
          </div>
        </DialogShell>
      )}
    </Dialog.Root>
  );
}

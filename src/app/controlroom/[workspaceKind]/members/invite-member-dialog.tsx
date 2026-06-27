"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Mail, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { inviteAgencyMemberAction } from "@/modules/agencies/actions";

export function InviteMemberDialog() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button className="h-11 px-5 font-semibold">
          <UserPlus className="size-4" />
          Invite agent
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] w-[min(94vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Paid agent roster
              </p>
              <Dialog.Title className="mt-2 text-2xl font-semibold">
                Invite agent
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                Invite an existing or new Homzie user profile to join this agency as a paid public agent.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close invite dialog">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          <form
            ref={formRef}
            action={async (formData) => {
              await inviteAgencyMemberAction(formData);
              formRef.current?.reset();
              setOpen(false);
            }}
            className="mt-5"
          >
            <label className="text-sm font-semibold">
              Agent email
              <span className="mt-2 flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <input
                  required
                  type="email"
                  name="email"
                  placeholder="agent@example.com"
                  className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground"
                />
              </span>
            </label>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" className="font-semibold">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" className="font-semibold">
                <UserPlus className="size-4" />
                Send invite
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

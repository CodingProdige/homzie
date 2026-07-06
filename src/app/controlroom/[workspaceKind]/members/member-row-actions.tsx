"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, ShieldBan, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { updateAgencyMemberStatusAction } from "@/modules/agencies/actions";

type MemberStatus = "active" | "invited" | "removed" | "suspended";

export function MemberRowActions({
  memberId,
  protectedMember,
  status,
}: {
  memberId: string;
  protectedMember?: boolean;
  status: MemberStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const nextStatus = status === "suspended" ? "active" : "suspended";
  const nextStatusLabel = status === "suspended" ? "Reactivate member" : "Suspend member";
  const NextStatusIcon = status === "suspended" ? UserCheck : ShieldBan;

  if (protectedMember) {
    return <span className="text-xs font-normal text-muted-foreground">Protected</span>;
  }

  function updateStatus(nextMemberStatus: Exclude<MemberStatus, "invited">) {
    setOpen(false);
    startTransition(() => {
      const formData = new FormData();
      formData.set("memberId", memberId);
      formData.set("status", nextMemberStatus);

      void updateAgencyMemberStatusAction(formData)
        .then(() => router.refresh())
        .catch((error: unknown) => {
          console.error("[agency] member status update failed", error);
        });
    });
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu.Root modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            disabled={isPending}
            aria-label="Open member actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-[90] min-w-52 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
          >
            {status !== "invited" ? (
              <DropdownMenu.Item
                disabled={isPending}
                onSelect={() => updateStatus(nextStatus)}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-bold outline-none transition-colors hover:bg-muted focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <NextStatusIcon className="size-4 text-muted-foreground" />
                {nextStatusLabel}
              </DropdownMenu.Item>
            ) : null}
            <DropdownMenu.Item
              disabled={isPending}
              onSelect={() => updateStatus("removed")}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-bold text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              <UserX className="size-4" />
              {status === "invited" ? "Cancel invite" : "Remove member"}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, ShieldBan, UserCheck, UserX } from "lucide-react";

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
  if (protectedMember) {
    return <span className="text-xs font-normal text-muted-foreground">Protected</span>;
  }

  const nextStatus = status === "suspended" ? "active" : "suspended";
  const nextStatusLabel = status === "suspended" ? "Reactivate member" : "Suspend member";
  const NextStatusIcon = status === "suspended" ? UserCheck : ShieldBan;

  return (
    <div className="flex justify-end">
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
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
            <form action={updateAgencyMemberStatusAction}>
              <input type="hidden" name="memberId" value={memberId} />
              <input type="hidden" name="status" value={nextStatus} />
              <DropdownMenu.Item asChild>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-bold outline-none transition-colors hover:bg-muted focus:bg-muted"
                >
                  <NextStatusIcon className="size-4 text-muted-foreground" />
                  {nextStatusLabel}
                </button>
              </DropdownMenu.Item>
            </form>
            <form action={updateAgencyMemberStatusAction}>
              <input type="hidden" name="memberId" value={memberId} />
              <input type="hidden" name="status" value="removed" />
              <DropdownMenu.Item asChild>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-bold text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10"
                >
                  <UserX className="size-4" />
                  Remove member
                </button>
              </DropdownMenu.Item>
            </form>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

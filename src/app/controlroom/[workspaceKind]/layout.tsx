import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ShieldCheck } from "lucide-react";

import { AgencyShell } from "@/app/agency/agency-shell";
import { Button } from "@/components/ui/button";
import { sql } from "@/db";
import { toPublicMediaUrl } from "@/media/paths";
import { getUnreadAgencyActivityCount } from "@/modules/agencies/activity";
import { stopAdminAgencySupportAction } from "@/modules/agencies/admin-support-actions";
import { agencyControlRoomLogoPathFromSettings } from "@/modules/agencies/brand-style";
import {
  controlRoomKindForWorkspace,
  controlRoomLabel,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import {
  agencyEmployeeRoleLabel,
  agencyRoleLabel,
  agencyTypeLabel,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";

type ControlRoomLayoutUser = {
  email: string;
  name: string;
};

type ControlRoomLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    workspaceKind: string;
  }>;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export const dynamic = "force-dynamic";

async function getControlRoomUser(userId: string) {
  const [user] = await sql<ControlRoomLayoutUser[]>`
    SELECT email, name
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return user || null;
}

export default async function ControlRoomLayout({
  children,
  params,
}: ControlRoomLayoutProps) {
  const [{ workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) {
    notFound();
  }

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/controlroom/${kind}`);
  }

  const [user, workspace] = await Promise.all([
    getControlRoomUser(session.user.id),
    getPrimaryAgencyWorkspace(session.user.id),
  ]);

  if (workspace && controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(controlRoomPathForWorkspace(workspace));
  }

  const activityCount = workspace
    ? await getUnreadAgencyActivityCount(workspace.agency.id)
    : 0;
  const workspaceLabel = workspace?.agency.name || "Agency workspace";
  let accessLabel: string | null = null;

  if (workspace?.membership.accessType === "admin_support") {
    accessLabel = "Homzie support admin";
  } else if (
    workspace?.membership.accessType === "employee" &&
    workspace.membership.employeeRole
  ) {
    accessLabel = `${agencyEmployeeRoleLabel(workspace.membership.employeeRole)} employee`;
  } else if (workspace) {
    accessLabel = agencyRoleLabel(workspace.membership.role);
  }

  const accountLabel = workspace
    ? `${agencyTypeLabel(workspace.agency.agencyType)} · ${accessLabel}`
    : user?.email || user?.name || "Create workspace";
  const isAdminSupportMode =
    workspace?.membership.accessType === "admin_support";

  return (
    <AgencyShell
      accountLabel={accountLabel}
      activityCount={activityCount}
      agencyType={workspace?.agency.agencyType || "independent"}
      basePath={`/controlroom/${kind}`}
      controlRoomLogoUrl={toPublicMediaUrl(
        agencyControlRoomLogoPathFromSettings(workspace?.agency.settings),
      )}
      roomLabel={controlRoomLabel(kind)}
      workspaceLabel={workspaceLabel}
    >
      {isAdminSupportMode ? (
        <section className="border-b border-amber-300/70 bg-amber-500/10 px-4 py-3 text-foreground sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <ShieldCheck className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Admin support mode</p>
                <p className="mt-0.5 text-xs font-normal leading-5 text-muted-foreground">
                  Managing {workspaceLabel} as{" "}
                  {user?.email || user?.name || "Homzie admin"}.
                </p>
              </div>
            </div>
            <form action={stopAdminAgencySupportAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
              >
                Exit support
              </Button>
            </form>
          </div>
        </section>
      ) : null}
      {children}
    </AgencyShell>
  );
}

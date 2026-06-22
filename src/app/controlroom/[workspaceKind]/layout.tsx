import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AgencyShell } from "@/app/agency/agency-shell";
import { sql } from "@/db";
import {
  controlRoomKindForWorkspace,
  controlRoomLabel,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import {
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

  const workspaceLabel = workspace?.agency.name || "Agency workspace";
  const accountLabel = workspace
    ? `${agencyTypeLabel(workspace.agency.agencyType)} · ${agencyRoleLabel(workspace.membership.role)}`
    : user?.email || user?.name || "Create workspace";

  return (
    <AgencyShell
      accountLabel={accountLabel}
      agencyType={workspace?.agency.agencyType || "independent"}
      basePath={`/controlroom/${kind}`}
      roomLabel={controlRoomLabel(kind)}
      workspaceLabel={workspaceLabel}
    >
      {children}
    </AgencyShell>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { sql } from "@/db";
import {
  agencyRoleLabel,
  agencyTypeLabel,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import {
  controlRoomLabel,
  controlRoomPathForWorkspace,
  controlRoomKindForWorkspace,
} from "@/modules/agencies/control-room";
import { authOptions } from "@/modules/auth/config";
import { AgencyShell } from "./agency-shell";

type AgencyLayoutUser = {
  email: string;
  name: string;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

export const dynamic = "force-dynamic";

async function getAgencyLayoutUser(userId: string) {
  const [user] = await sql<AgencyLayoutUser[]>`
    SELECT email, name
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return user || null;
}

export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/controlroom");
  }

  const [user, workspace] = await Promise.all([
    getAgencyLayoutUser(session.user.id),
    getPrimaryAgencyWorkspace(session.user.id),
  ]);

  const workspaceLabel = workspace?.agency.name || "Agency workspace";
  const accountLabel = workspace
    ? `${agencyTypeLabel(workspace.agency.agencyType)} · ${agencyRoleLabel(workspace.membership.role)}`
    : user?.email || user?.name || "Create workspace";
  const basePath = controlRoomPathForWorkspace(workspace);
  const roomLabel = workspace
    ? controlRoomLabel(controlRoomKindForWorkspace(workspace))
    : "Control room";

  return (
    <AgencyShell
      accountLabel={accountLabel}
      basePath={basePath}
      roomLabel={roomLabel}
      workspaceLabel={workspaceLabel}
    >
      {children}
    </AgencyShell>
  );
}

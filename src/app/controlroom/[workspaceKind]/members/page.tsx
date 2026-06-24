import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { UsersRound } from "lucide-react";

import { CanonicalTable, type CanonicalTableColumn } from "@/components/ui/canonical-table";
import { sql } from "@/db";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import { agencyRoleLabel, getPrimaryAgencyWorkspace } from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberRowActions } from "./member-row-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Members | Homzie Control Room",
  description: "Manage paid linked agents in your Homzie control room.",
};

type MembersPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
};

type MemberRow = {
  agency_funded: boolean;
  email: string | null;
  id: string;
  invited_email: string | null;
  listing_count: number | string;
  name: string | null;
  role: "admin" | "agent" | "listing_manager" | "owner";
  status: "active" | "invited" | "removed" | "suspended";
  username: string | null;
};

function statusBadge(status: MemberRow["status"]) {
  const tone =
    status === "active"
      ? "bg-emerald-500/10 text-emerald-700"
      : status === "invited"
        ? "bg-primary/10 text-primary"
        : status === "suspended"
          ? "bg-amber-500/15 text-amber-700"
          : "bg-muted text-muted-foreground";

  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${tone}`}>
      {status}
    </span>
  );
}

export default async function MembersPage({ params }: MembersPageProps) {
  const [{ workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) redirect("/controlroom");
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/controlroom/${kind}/members`);

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace) redirect(`/controlroom/${kind}`);
  if (controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(`${controlRoomPathForWorkspace(workspace)}/members`);
  }

  const canManage = workspace.membership.canManageMembers;
  const members = await sql<MemberRow[]>`
    SELECT
      am.id,
      am.invited_email,
      am.role,
      am.status,
      am.agency_funded,
      u.name,
      u.username,
      u.email,
      count(DISTINCT pl.id) FILTER (WHERE pl.status = 'published')::int AS listing_count
    FROM agency_members am
    LEFT JOIN users u ON u.id = am.user_id
    LEFT JOIN property_listings pl ON pl.user_id = am.user_id
    WHERE am.agency_id = ${workspace.agency.id}
      AND am.status <> 'removed'
    GROUP BY am.id, u.name, u.username, u.email
    ORDER BY
      CASE am.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 WHEN 'suspended' THEN 2 ELSE 3 END,
      CASE am.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'listing_manager' THEN 2 ELSE 3 END,
      coalesce(u.name, am.invited_email) ASC
  `;

  const columns: Array<CanonicalTableColumn<MemberRow>> = [
    {
      header: "Agent",
      key: "agent",
      render: (member) => (
        <div className="min-w-0">
          <p className="truncate font-black">
            {member.name || member.invited_email || "Pending agent"}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
            {member.username ? `@${member.username}` : member.email || member.invited_email}
          </p>
        </div>
      ),
    },
    {
      header: "Role",
      key: "role",
      render: (member) => (
        <div>
          <p className="font-black">{agencyRoleLabel(member.role)}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Paid public agent seat
          </p>
        </div>
      ),
    },
    {
      header: "Status",
      key: "status",
      render: (member) => statusBadge(member.status),
    },
    {
      header: "Listings",
      key: "listings",
      render: (member) => (
        <div className="text-sm font-semibold text-muted-foreground">
          <p>{Number(member.listing_count)} active</p>
          <p>Agency-funded</p>
        </div>
      ),
    },
    {
      className: "w-20 text-right",
      header: "Actions",
      key: "actions",
      render: (member) => (
        <MemberRowActions
          memberId={member.id}
          protectedMember={!canManage || member.role === "owner"}
          status={member.status}
        />
      ),
      useRowHref: false,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Paid agent roster
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Members
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
            Members are linked public agents. They count as agency-funded seats, appear on listings and leaderboards, and inherit agency branding while linked.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-black text-muted-foreground shadow-sm">
            <UsersRound className="size-4 text-primary" />
            {members.length} paid seats
          </span>
          {canManage ? <InviteMemberDialog /> : null}
        </div>
      </div>

      <section className="mt-8">
        <CanonicalTable
          columns={columns}
          emptyState="No linked paid agents yet."
          getRowKey={(member) => member.id}
          minWidth="760px"
          rows={members}
        />
      </section>
    </main>
  );
}

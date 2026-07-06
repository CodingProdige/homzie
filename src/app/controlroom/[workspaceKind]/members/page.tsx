import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CreditCard, ReceiptText, UsersRound } from "lucide-react";

import { AgentProfileAvatar } from "@/components/agent-profile-avatar";
import { Button } from "@/components/ui/button";
import { CanonicalTable, type CanonicalTableColumn } from "@/components/ui/canonical-table";
import { sql } from "@/db";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import { agencyRoleLabel, getPrimaryAgencyWorkspace } from "@/modules/agencies/server";
import {
  formatAgencyBillingDate,
  formatAgencyBillingMoney,
  getAgencySeatBillingSnapshot,
} from "@/modules/agencies/billing";
import { authOptions } from "@/modules/auth/config";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberRowActions } from "./member-row-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Members | Homzie Control Room",
  description: "Manage agency-funded linked agents in your Homzie control room.",
};

type MembersPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
};

type MemberRow = {
  agency_funded: boolean;
  avatar_url: string | null;
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
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${tone}`}>
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

  if (workspace.agency.agencyType === "network") {
    redirect(`${controlRoomPathForWorkspace(workspace)}/branches`);
  }

  const canManage = workspace.membership.canManageMembers;
  const billingSettingsHref = `${controlRoomPathForWorkspace(workspace)}/settings/billing`;
  const [members, billingSnapshot] = await Promise.all([
    sql<MemberRow[]>`
      SELECT
        am.id,
        am.invited_email,
        am.role,
        am.status,
        am.agency_funded,
        u.name,
        u.username,
        u.email,
        u.avatar_url,
        count(DISTINCT pl.id) FILTER (WHERE pl.status = 'published')::int AS listing_count
      FROM agency_members am
      LEFT JOIN users u ON u.id = am.user_id
      LEFT JOIN property_listings pl ON pl.user_id = am.user_id
      WHERE am.agency_id = ${workspace.agency.id}
        AND am.status <> 'removed'
      GROUP BY am.id, u.name, u.username, u.email, u.avatar_url
      ORDER BY
        CASE am.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 WHEN 'suspended' THEN 2 ELSE 3 END,
        CASE am.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'listing_manager' THEN 2 ELSE 3 END,
        coalesce(u.name, am.invited_email) ASC
    `,
    getAgencySeatBillingSnapshot(workspace.agency.id),
  ]);

  const columns: Array<CanonicalTableColumn<MemberRow>> = [
    {
      header: "Agent",
      key: "agent",
      render: (member) => {
        const name = member.name || member.invited_email || "Pending agent";

        return (
          <div className="flex min-w-0 items-center gap-3">
            <AgentProfileAvatar avatarUrl={member.avatar_url} name={name} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
                {member.username ? `@${member.username}` : member.email || member.invited_email}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: "Role",
      key: "role",
      render: (member) => (
        <div>
          <p className="font-semibold">{agencyRoleLabel(member.role)}</p>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            Agency-funded public agent seat
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
        <div className="text-sm font-normal text-muted-foreground">
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Agency-funded roster
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Members
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
            Members are linked public agents. They count as agency-funded seats, appear on listings and leaderboards, and inherit agency branding while linked.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-normal text-muted-foreground shadow-sm">
            <UsersRound className="size-4 text-primary" />
            {members.length} agency-funded seats
          </span>
          {canManage ? (
            <InviteMemberDialog
              billingReady={billingSnapshot.billingConfigured}
              billingSettingsHref={billingSettingsHref}
            />
          ) : null}
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Billing breakdown
            </p>
            <h2 className="mt-2 text-xl font-semibold">Peak-seat billing</h2>
            <p className="mt-2 max-w-3xl text-sm font-normal leading-6 text-muted-foreground">
              Automated agency billing uses the maximum agency-funded seats used in
              each 30-day cycle, not the count on billing day.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-normal text-muted-foreground">
            <CreditCard className="size-4 text-primary" />
            {billingSnapshot.billingConfigured ? "Billing ready" : "Billing required"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 rounded-lg border border-border bg-background p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Current seats
            </p>
            <p className="mt-2 text-2xl font-semibold">{billingSnapshot.currentSeats}</p>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-background p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Cycle peak
            </p>
            <p className="mt-2 text-2xl font-semibold">{billingSnapshot.maxBillableSeats}</p>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-background p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Seat price
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatAgencyBillingMoney(
                billingSnapshot.unitAmountCents,
                billingSnapshot.currency,
              )}
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-background p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Projected invoice
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatAgencyBillingMoney(
                billingSnapshot.projectedTotalCents,
                billingSnapshot.currency,
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-normal leading-6 text-muted-foreground">
            Period: {formatAgencyBillingDate(billingSnapshot.periodStart)} - {formatAgencyBillingDate(billingSnapshot.periodEnd)}. Invited, active, and suspended members reserve agency-funded seats until removed.
          </p>
          {!billingSnapshot.billingConfigured && workspace.membership.canManageBilling ? (
            <Button asChild variant="outline" className="font-semibold">
              <Link href={billingSettingsHref}>
                <ReceiptText className="size-4" />
                Update billing
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <CanonicalTable
          columns={columns}
          emptyState="No linked agency-funded agents yet."
          getRowHref={(member) => (member.username ? `/users/${member.username}` : "")}
          getRowKey={(member) => member.id}
          minWidth="760px"
          rows={members}
        />
      </section>
    </main>
  );
}

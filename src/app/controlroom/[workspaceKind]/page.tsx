import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  CreditCard,
  Radar,
  Settings,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { sql } from "@/db";
import {
  acceptAgencyOwnershipTransferAction,
  declineAgencyOwnershipTransferAction,
} from "@/modules/agencies/actions";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import {
  agencyRoleLabel,
  agencyTypeLabel,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control Room | Homzie",
  description: "Manage agency and network operations on Homzie.",
};

type ControlRoomPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
};

type AgencySummaryRow = {
  active_members: number;
  invited_members: number;
  listing_requests: number;
  published_listings: number;
};

type IncomingTransferRow = {
  agency_name: string;
  agency_type: "independent" | "network" | "branch";
  expires_at: Date;
  id: string;
  message: string | null;
};

function statusLabel(status: string) {
  if (status === "pending") return "Pending review";
  if (status === "active") return "Active";
  if (status === "suspended") return "Suspended";

  return status;
}

export default async function ControlRoomDashboardPage({
  params,
}: ControlRoomPageProps) {
  const [{ workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) {
    redirect("/controlroom");
  }

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/controlroom/${kind}`);
  }

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);
  const incomingTransfers = await sql<IncomingTransferRow[]>`
    SELECT
      t.id,
      t.message,
      t.expires_at,
      a.name AS agency_name,
      a.agency_type
    FROM agency_ownership_transfers t
    INNER JOIN agencies a ON a.id = t.agency_id
    INNER JOIN users u ON u.id = ${session.user.id}
    WHERE t.status = 'pending'
      AND t.expires_at > now()
      AND (
        t.recipient_user_id = ${session.user.id}
        OR lower(t.recipient_email) = lower(u.email)
      )
    ORDER BY t.created_at DESC
  `;

  if (workspace && controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(controlRoomPathForWorkspace(workspace));
  }

  if (!workspace) {
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-4xl place-items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="w-full rounded-lg border border-border bg-card p-6 text-center shadow-sm sm:p-8">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Building2 className="size-7" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Control room
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Create an agency workspace
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
            Set up an agency, branch, or Network HQ before using the control room.
          </p>
          <Button asChild className="mt-6 h-11 px-6 font-semibold">
            <Link href="/agency/apply">
              Create workspace
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>

        {incomingTransfers.length ? (
          <section className="mt-4 w-full rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Ownership transfer
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              You have an agency waiting for you
            </h2>
            <div className="mt-4 grid gap-3">
              {incomingTransfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="rounded-lg border border-border bg-background p-4 text-left"
                >
                  <p className="font-semibold">{transfer.agency_name}</p>
                  <p className="mt-1 text-sm font-normal text-muted-foreground">
                    {agencyTypeLabel(transfer.agency_type)} ownership transfer
                  </p>
                  {transfer.message ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {transfer.message}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={acceptAgencyOwnershipTransferAction}>
                      <input type="hidden" name="transferId" value={transfer.id} />
                      <Button type="submit" size="sm" className="h-9 font-semibold">
                        Accept ownership
                      </Button>
                    </form>
                    <form action={declineAgencyOwnershipTransferAction}>
                      <input type="hidden" name="transferId" value={transfer.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="h-9 font-semibold"
                      >
                        Decline
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    );
  }

  const [summary] = await sql<AgencySummaryRow[]>`
    SELECT
      count(*) FILTER (WHERE status = 'active')::int AS active_members,
      count(*) FILTER (WHERE status = 'invited')::int AS invited_members,
      0::int AS listing_requests,
      0::int AS published_listings
    FROM agency_members
    WHERE agency_id = ${workspace.agency.id}
      AND status <> 'removed'
  `;

  const basePath = `/controlroom/${kind}`;
  const metrics = [
    {
      icon: UsersRound,
      label: "Active members",
      value: summary?.active_members || 0,
      helper: `${summary?.invited_members || 0} invites pending`,
    },
    {
      icon: Building2,
      label: "Agency listings",
      value: summary?.published_listings || 0,
      helper: "Listing ownership comes next",
    },
    {
      icon: ClipboardCheck,
      label: "Listing requests",
      value: summary?.listing_requests || 0,
      helper: "Approval workflow comes after invites",
    },
    {
      icon: Radar,
      label: "Buyer activity",
      value: 0,
      helper: "Rollup activates with agency listings",
    },
  ];
  const nextSections = [
    {
      cta: "Coming next",
      icon: UsersRound,
      title: "Team members",
      text: "Invite agents, assign roles, and control who can publish directly or only submit listing requests.",
    },
    {
      cta: "Planned",
      icon: ClipboardCheck,
      title: "Listing requests",
      text: "Agents will submit listing drafts to the agency for edit, approval, decline, or publishing.",
    },
    {
      cta: "Planned",
      icon: Radar,
      title: "Agency buyer activity",
      text: "Realtime buyer intent will roll up across every agency-owned listing and assigned agent.",
    },
    {
      cta: "Planned",
      icon: CreditCard,
      title: "Agency billing",
      text: "Agency seats and listing marketing will be billed to the agency instead of individual linked agents.",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {kind === "networkhq" ? "Network HQ control room" : "Agency control room"}
          </p>
          <h1 className="mt-3 truncate text-4xl font-semibold tracking-tight sm:text-5xl">
            {workspace.agency.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
            {agencyTypeLabel(workspace.agency.agencyType)} ·{" "}
            {agencyRoleLabel(workspace.membership.role)} ·{" "}
            {statusLabel(workspace.agency.status)}
          </p>
        </div>
        <Button asChild variant="outline" className="h-10 w-fit font-semibold">
          <Link href={`${basePath}/settings`}>
            <Settings className="size-4" />
            Settings
          </Link>
        </Button>
      </div>

      <section className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div
                key={metric.label}
                className="rounded-lg border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold leading-none">
                      {metric.value}
                    </p>
                    <p className="mt-2 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                      {metric.label}
                    </p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                </div>
                <p className="mt-4 text-xs font-normal leading-5 text-muted-foreground">
                  {metric.helper}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {incomingTransfers.length ? (
        <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Incoming ownership
          </p>
          <h2 className="mt-2 text-xl font-semibold">Ownership requests for you</h2>
          <div className="mt-4 grid gap-3">
            {incomingTransfers.map((transfer) => (
              <div
                key={transfer.id}
                className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold">{transfer.agency_name}</p>
                  <p className="mt-1 text-sm font-normal text-muted-foreground">
                    {agencyTypeLabel(transfer.agency_type)} ownership transfer
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={acceptAgencyOwnershipTransferAction}>
                    <input type="hidden" name="transferId" value={transfer.id} />
                    <Button type="submit" size="sm" className="h-9 font-semibold">
                      Accept
                    </Button>
                  </form>
                  <form action={declineAgencyOwnershipTransferAction}>
                    <input type="hidden" name="transferId" value={transfer.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="h-9 font-semibold"
                    >
                      Decline
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8 grid gap-3 lg:grid-cols-2">
        {nextSections.map((section) => {
          const Icon = section.icon;

          return (
            <div
              key={section.title}
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-normal uppercase text-muted-foreground">
                  {section.cta}
                </span>
              </div>
              <h2 className="mt-4 text-xl font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                {section.text}
              </p>
            </div>
          );
        })}
      </section>
    </main>
  );
}

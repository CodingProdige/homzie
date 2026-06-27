import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Building2, Home, Network, UsersRound, type LucideIcon } from "lucide-react";

import { BackButton } from "@/components/back-button";
import {
  CanonicalTable,
  type CanonicalTableColumn,
} from "@/components/ui/canonical-table";
import { sql } from "@/db";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import { getPrimaryAgencyWorkspace } from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Branch details | Homzie Control Room",
  description: "View a linked branch's team and listing performance.",
};

type BranchDetailPageProps = {
  params: Promise<{
    branchId: string;
    workspaceKind: string;
  }>;
};

type BranchSummary = {
  action_count: number | string;
  active_listings: number | string;
  branch_code: string | null;
  id: string;
  listing_count: number | string;
  member_count: number | string;
  name: string;
  region: string | null;
  sold_count: number | string;
  view_count: number | string;
};

type BranchAgentRow = {
  active_listings: number | string;
  email: string | null;
  name: string;
  role: string;
  user_id: string;
  username: string | null;
};

type BranchListingRow = {
  asking_price_cents: number | null;
  location: string | null;
  sold_at: Date | null;
  title: string;
  updated_at: Date;
};

function numberLabel(value: number | string) {
  return new Intl.NumberFormat("en-ZA").format(Number(value || 0));
}

function moneyLabel(cents: number | null) {
  if (!cents) return "Price not set";

  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

function dateLabel(value: Date | null) {
  if (!value) return "Date not set";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function BranchDetailPage({ params }: BranchDetailPageProps) {
  const [{ branchId, workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) redirect("/controlroom");
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/controlroom/${kind}/network/${branchId}`);
  }

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace) redirect(`/controlroom/${kind}`);
  if (controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(`${controlRoomPathForWorkspace(workspace)}/network/${branchId}`);
  }

  if (workspace.agency.agencyType === "network") {
    redirect(`${controlRoomPathForWorkspace(workspace)}/branches`);
  }

  if (
    workspace.agency.parentLinkStatus !== "linked" ||
    !workspace.agency.parentAgencyId
  ) {
    redirect(`${controlRoomPathForWorkspace(workspace)}/network`);
  }

  const basePath = controlRoomPathForWorkspace(workspace);
  const [branch] = await sql<BranchSummary[]>`
    WITH branch_members AS (
      SELECT
        a.id AS branch_id,
        a.name,
        a.region,
        a.branch_code,
        am.user_id
      FROM agencies a
      LEFT JOIN agency_members am
        ON am.agency_id = a.id
        AND am.status = 'active'
      WHERE a.id = ${branchId}
        AND a.agency_type = 'branch'
        AND a.parent_agency_id = ${workspace.agency.parentAgencyId}
        AND a.parent_link_status = 'linked'
    ),
    branch_listings AS (
      SELECT bm.branch_id, pl.id, pl.status
      FROM branch_members bm
      LEFT JOIN property_listings pl ON pl.user_id = bm.user_id
    ),
    branch_views AS (
      SELECT bl.branch_id, count(lve.id)::int AS view_count
      FROM branch_listings bl
      INNER JOIN listing_view_events lve ON lve.listing_id = bl.id
      WHERE lve.created_at >= now() - interval '30 days'
      GROUP BY bl.branch_id
    ),
    branch_actions AS (
      SELECT bl.branch_id, count(lae.id)::int AS action_count
      FROM branch_listings bl
      INNER JOIN listing_action_events lae ON lae.listing_id = bl.id
      WHERE lae.created_at >= now() - interval '30 days'
      GROUP BY bl.branch_id
    )
    SELECT
      bm.branch_id AS id,
      max(bm.name) AS name,
      max(bm.region) AS region,
      max(bm.branch_code) AS branch_code,
      count(DISTINCT bm.user_id)::int AS member_count,
      count(DISTINCT bl.id)::int AS listing_count,
      count(DISTINCT bl.id) FILTER (WHERE bl.status = 'published')::int AS active_listings,
      count(DISTINCT bl.id) FILTER (WHERE bl.status IN ('sold', 'sold_externally'))::int AS sold_count,
      coalesce(max(bv.view_count), 0)::int AS view_count,
      coalesce(max(ba.action_count), 0)::int AS action_count
    FROM branch_members bm
    LEFT JOIN branch_listings bl ON bl.branch_id = bm.branch_id
    LEFT JOIN branch_views bv ON bv.branch_id = bm.branch_id
    LEFT JOIN branch_actions ba ON ba.branch_id = bm.branch_id
    GROUP BY bm.branch_id
    LIMIT 1
  `;

  if (!branch) notFound();

  const [agents, soldListings] = await Promise.all([
    sql<BranchAgentRow[]>`
      SELECT
        u.id AS user_id,
        u.name,
        u.username,
        u.email,
        am.role,
        count(pl.id) FILTER (WHERE pl.status = 'published')::int AS active_listings
      FROM agency_members am
      INNER JOIN users u ON u.id = am.user_id
      LEFT JOIN property_listings pl ON pl.user_id = u.id
      WHERE am.agency_id = ${branch.id}
        AND am.status = 'active'
      GROUP BY u.id, am.role
      ORDER BY
        CASE am.role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'listing_manager' THEN 2
          ELSE 3
        END,
        u.name ASC
    `,
    sql<BranchListingRow[]>`
      SELECT
        pl.title,
        pl.location,
        pl.asking_price_cents,
        pl.sold_at,
        pl.updated_at
      FROM agency_members am
      INNER JOIN property_listings pl ON pl.user_id = am.user_id
      WHERE am.agency_id = ${branch.id}
        AND am.status = 'active'
        AND pl.status IN ('sold', 'sold_externally')
      ORDER BY coalesce(pl.sold_at, pl.updated_at) DESC
      LIMIT 8
    `,
  ]);

  const agentColumns: Array<CanonicalTableColumn<BranchAgentRow>> = [
    {
      header: "Agent",
      key: "agent",
      render: (agent) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{agent.name}</p>
          <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
            {agent.username ? `@${agent.username}` : agent.email || "No contact"}
          </p>
        </div>
      ),
    },
    {
      header: "Role",
      key: "role",
      render: (agent) => (
        <span className="capitalize text-muted-foreground">
          {agent.role.replaceAll("_", " ")}
        </span>
      ),
    },
    {
      header: "Listings",
      key: "listings",
      render: (agent) => (
        <span className="font-normal text-muted-foreground">
          {numberLabel(agent.active_listings)} active
        </span>
      ),
    },
  ];

  const listingColumns: Array<CanonicalTableColumn<BranchListingRow>> = [
    {
      header: "Listing",
      key: "listing",
      render: (listing) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{listing.title}</p>
          <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
            {listing.location || "No location"}
          </p>
        </div>
      ),
    },
    {
      header: "Price",
      key: "price",
      render: (listing) => (
        <span className="font-normal text-muted-foreground">
          {moneyLabel(listing.asking_price_cents)}
        </span>
      ),
    },
    {
      header: "Sold",
      key: "sold",
      render: (listing) => (
        <span className="font-normal text-muted-foreground">
          {dateLabel(listing.sold_at || listing.updated_at)}
        </span>
      ),
    },
  ];
  const stats: Array<{ icon: LucideIcon; label: string; value: string }> = [
    {
      icon: UsersRound,
      label: "Members",
      value: `${numberLabel(branch.member_count)} active`,
    },
    {
      icon: Home,
      label: "Listings",
      value: `${numberLabel(branch.active_listings)} active`,
    },
    {
      icon: Building2,
      label: "Sold",
      value: `${numberLabel(branch.sold_count)} listings`,
    },
    {
      icon: Network,
      label: "Buyer activity",
      value: `${numberLabel(branch.view_count)} views · ${numberLabel(branch.action_count)} actions`,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <BackButton href={`${basePath}/network`} label="Back to network" className="mb-4" />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Branch insight
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {branch.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
            {branch.region || "No region set"}{branch.branch_code ? ` · ${branch.branch_code}` : ""}
          </p>
        </div>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 truncate text-lg font-semibold">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <UsersRound className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">Agents</h2>
        </div>
        <CanonicalTable
          columns={agentColumns}
          emptyState="This branch has no active agents yet."
          getRowKey={(agent) => agent.user_id}
          minWidth="620px"
          rows={agents}
        />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">Recently sold listings</h2>
        </div>
        <CanonicalTable
          columns={listingColumns}
          emptyState="No sold listings captured for this branch yet."
          getRowKey={(listing) => `${listing.title}-${listing.updated_at.toISOString()}`}
          minWidth="680px"
          rows={soldListings}
        />
      </section>
    </main>
  );
}

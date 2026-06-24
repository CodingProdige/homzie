import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowUpRight, Building2, Network, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CanonicalTable,
  type CanonicalTableColumn,
} from "@/components/ui/canonical-table";
import { sql } from "@/db";
import {
  leaveNetworkAction,
  requestNetworkLinkAction,
} from "@/modules/agencies/actions";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import { getPrimaryAgencyWorkspace } from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";
import { NetworkSearchPicker } from "./network-search-picker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Network | Homzie Control Room",
  description: "Manage your agency network affiliation and branch visibility.",
};

type NetworkPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
};

type NetworkOption = {
  id: string;
  name: string;
  region: string | null;
  slug: string;
};

type ParentNetwork = NetworkOption & {
  branding_policy: "branch_branding_allowed" | "network_branding_enforced";
};

type BranchDirectoryRow = {
  action_count: number | string;
  active_listings: number | string;
  branch_id: string;
  branch_name: string;
  listing_count: number | string;
  member_count: number | string;
  region: string | null;
  sold_count: number | string;
  view_count: number | string;
};

function numberLabel(value: number | string) {
  return new Intl.NumberFormat("en-ZA").format(Number(value || 0));
}

function linkStatusLabel(status: "none" | "pending" | "linked" | "declined") {
  if (status === "linked") return "Linked";
  if (status === "pending") return "Pending review";
  if (status === "declined") return "Declined";

  return "Not linked";
}

export default async function NetworkPage({ params }: NetworkPageProps) {
  const [{ workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) redirect("/controlroom");
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/controlroom/${kind}/network`);

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace) redirect(`/controlroom/${kind}`);
  if (controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(`${controlRoomPathForWorkspace(workspace)}/network`);
  }

  if (workspace.agency.agencyType === "network") {
    redirect(`${controlRoomPathForWorkspace(workspace)}/branches`);
  }

  const basePath = controlRoomPathForWorkspace(workspace);
  const linkedParentId =
    workspace.agency.parentLinkStatus === "linked" ? workspace.agency.parentAgencyId : null;
  const [parentNetwork] = linkedParentId
    ? await sql<ParentNetwork[]>`
        SELECT id, name, slug, region, branding_policy
        FROM agencies
        WHERE id = ${linkedParentId}
          AND agency_type = 'network'
        LIMIT 1
      `
    : [];
  const networkOptions = await sql<NetworkOption[]>`
    SELECT id, name, slug, region
    FROM agencies
    WHERE agency_type = 'network'
      AND id <> ${workspace.agency.id}
      AND status <> 'suspended'
    ORDER BY name ASC
  `;
  const branchRows = parentNetwork
    ? await sql<BranchDirectoryRow[]>`
        WITH branch_members AS (
          SELECT
            a.id AS branch_id,
            a.name AS branch_name,
            a.region,
            am.user_id
          FROM agencies a
          LEFT JOIN agency_members am
            ON am.agency_id = a.id
            AND am.status = 'active'
          WHERE a.agency_type = 'branch'
            AND a.parent_agency_id = ${parentNetwork.id}
            AND a.parent_link_status = 'linked'
        ),
        branch_listings AS (
          SELECT
            bm.branch_id,
            pl.id,
            pl.status
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
          bm.branch_id,
          bm.branch_name,
          bm.region,
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
        GROUP BY bm.branch_id, bm.branch_name, bm.region
        ORDER BY
          (coalesce(max(bv.view_count), 0) + coalesce(max(ba.action_count), 0) * 2) DESC,
          bm.branch_name ASC
      `
    : [];

  const columns: Array<CanonicalTableColumn<BranchDirectoryRow>> = [
    {
      header: "Branch",
      key: "branch",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-black">{row.branch_name}</p>
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
            {row.region || "No region set"}
          </p>
        </div>
      ),
    },
    {
      header: "Team",
      key: "team",
      render: (row) => (
        <span className="font-semibold text-muted-foreground">
          {numberLabel(row.member_count)} members
        </span>
      ),
    },
    {
      header: "Listings",
      key: "listings",
      render: (row) => (
        <div className="text-sm font-semibold text-muted-foreground">
          <p>{numberLabel(row.active_listings)} active</p>
          <p>{numberLabel(row.sold_count)} sold</p>
        </div>
      ),
    },
    {
      header: "Buyer activity",
      key: "activity",
      render: (row) => (
        <div className="text-sm font-semibold text-muted-foreground">
          <p>{numberLabel(row.view_count)} views</p>
          <p>{numberLabel(row.action_count)} actions</p>
        </div>
      ),
    },
    {
      className: "w-16 text-right",
      header: "",
      key: "open",
      render: () => <ArrowUpRight className="ml-auto size-4 text-primary" />,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Agency network
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Network
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
            Link your agency to an existing Network HQ, see sibling branches, and keep branch billing self-funded.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-black text-muted-foreground shadow-sm">
          <Network className="size-4 text-primary" />
          {linkStatusLabel(workspace.agency.parentLinkStatus)}
        </span>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
              Affiliation
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {parentNetwork?.name ||
                (workspace.agency.parentLinkStatus === "pending"
                  ? workspace.agency.requestedParentAgencyName
                  : "No network linked")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-muted-foreground">
              Network links give your agency brand relationship and branch visibility. Your seats remain paid by your own agency workspace, not the Network HQ.
            </p>
          </div>

          {workspace.agency.parentLinkStatus === "linked" || workspace.agency.parentLinkStatus === "pending" ? (
            <form action={leaveNetworkAction}>
              <Button type="submit" variant="outline">
                <Unlink className="size-4" />
                {workspace.agency.parentLinkStatus === "pending" ? "Cancel request" : "Leave network"}
              </Button>
            </form>
          ) : null}
        </div>

        {workspace.agency.parentLinkStatus !== "linked" &&
        workspace.agency.parentLinkStatus !== "pending" ? (
          <form action={requestNetworkLinkAction} className="mt-5">
            <NetworkSearchPicker options={networkOptions} />
          </form>
        ) : null}
      </section>

      {parentNetwork ? (
        <section className="mt-8">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                Network directory
              </p>
              <h2 className="mt-2 text-2xl font-black">Linked branches</h2>
            </div>
            <Button asChild variant="outline">
              <Link href={`${basePath}/leaderboard`}>
                <Building2 className="size-4" />
                Leaderboard
              </Link>
            </Button>
          </div>
          <CanonicalTable
            columns={columns}
            emptyState="No linked branches are visible yet."
            getRowHref={(row) => `${basePath}/network/${row.branch_id}`}
            getRowKey={(row) => row.branch_id}
            minWidth="720px"
            rows={branchRows}
          />
        </section>
      ) : null}
    </main>
  );
}

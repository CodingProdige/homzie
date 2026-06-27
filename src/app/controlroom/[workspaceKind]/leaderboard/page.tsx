import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ListOrdered, Trophy, UserRound } from "lucide-react";

import { CanonicalTable, type CanonicalTableColumn } from "@/components/ui/canonical-table";
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
  title: "Leaderboard | Homzie Control Room",
  description: "Rank branch and agent performance inside your control room where available.",
};

type LeaderboardPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
};

type BranchLeaderboardRow = {
  active_listings: number | string;
  action_count: number | string;
  agent_count: number | string;
  branch_id: string;
  branch_name: string;
  offer_count: number | string;
  region: string | null;
  score: number | string;
  view_count: number | string;
};

type AgentLeaderboardRow = {
  active_listings: number | string;
  action_count: number | string;
  agent_name: string;
  email: string | null;
  offer_count: number | string;
  role: string;
  score: number | string;
  user_id: string;
  username: string | null;
  view_count: number | string;
};

function scoreLabel(value: number | string) {
  return new Intl.NumberFormat("en-ZA").format(Number(value || 0));
}

function rankBadge(index: number) {
  const tone =
    index === 0
      ? "bg-amber-500/15 text-amber-700"
      : index === 1
        ? "bg-slate-500/15 text-slate-700"
        : index === 2
          ? "bg-orange-500/15 text-orange-700"
          : "bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex min-w-9 justify-center rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      #{index + 1}
    </span>
  );
}

export default async function LeaderboardPage({ params }: LeaderboardPageProps) {
  const [{ workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) redirect("/controlroom");
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/controlroom/${kind}/leaderboard`);

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace) redirect(`/controlroom/${kind}`);
  if (controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(`${controlRoomPathForWorkspace(workspace)}/leaderboard`);
  }

  const isNetwork = workspace.agency.agencyType === "network";
  const [branchRows, agentRows] = await Promise.all([
    isNetwork
      ? sql<BranchLeaderboardRow[]>`
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
              AND a.parent_agency_id = ${workspace.agency.id}
              AND a.parent_link_status = 'linked'
          ),
          branch_listings AS (
            SELECT
              bm.branch_id,
              pl.id,
              pl.status
            FROM branch_members bm
            INNER JOIN property_listings pl ON pl.user_id = bm.user_id
          ),
          branch_views AS (
            SELECT bl.branch_id, count(lve.id)::int AS view_count
            FROM branch_listings bl
            INNER JOIN listing_view_events lve ON lve.listing_id = bl.id
            WHERE lve.created_at >= now() - interval '30 days'
            GROUP BY bl.branch_id
          ),
          branch_actions AS (
            SELECT
              bl.branch_id,
              count(lae.id)::int AS action_count,
              count(*) FILTER (WHERE lae.action_type = 'offer_started')::int AS offer_count
            FROM branch_listings bl
            INNER JOIN listing_action_events lae ON lae.listing_id = bl.id
            WHERE lae.created_at >= now() - interval '30 days'
            GROUP BY bl.branch_id
          )
          SELECT
            bm.branch_id,
            bm.branch_name,
            bm.region,
            count(DISTINCT bm.user_id)::int AS agent_count,
            count(DISTINCT bl.id) FILTER (WHERE bl.status = 'published')::int AS active_listings,
            coalesce(max(bv.view_count), 0)::int AS view_count,
            coalesce(max(ba.action_count), 0)::int AS action_count,
            coalesce(max(ba.offer_count), 0)::int AS offer_count,
            (
              coalesce(max(bv.view_count), 0)
              + coalesce(max(ba.action_count), 0) * 2
              + coalesce(max(ba.offer_count), 0) * 5
            )::int AS score
          FROM branch_members bm
          LEFT JOIN branch_listings bl ON bl.branch_id = bm.branch_id
          LEFT JOIN branch_views bv ON bv.branch_id = bm.branch_id
          LEFT JOIN branch_actions ba ON ba.branch_id = bm.branch_id
          GROUP BY bm.branch_id, bm.branch_name, bm.region
          ORDER BY score DESC, view_count DESC, branch_name ASC
        `
      : Promise.resolve([] as BranchLeaderboardRow[]),
    sql<AgentLeaderboardRow[]>`
      WITH agent_listings AS (
        SELECT
          am.user_id,
          am.role,
          u.name AS agent_name,
          u.username,
          u.email,
          pl.id AS listing_id,
          pl.status
        FROM agency_members am
        INNER JOIN users u ON u.id = am.user_id
        LEFT JOIN property_listings pl ON pl.user_id = am.user_id
        WHERE am.agency_id = ${workspace.agency.id}
          AND am.status = 'active'
          AND am.user_id IS NOT NULL
      ),
      agent_views AS (
        SELECT al.user_id, count(lve.id)::int AS view_count
        FROM agent_listings al
        INNER JOIN listing_view_events lve ON lve.listing_id = al.listing_id
        WHERE lve.created_at >= now() - interval '30 days'
        GROUP BY al.user_id
      ),
      agent_actions AS (
        SELECT
          al.user_id,
          count(lae.id)::int AS action_count,
          count(*) FILTER (WHERE lae.action_type = 'offer_started')::int AS offer_count
        FROM agent_listings al
        INNER JOIN listing_action_events lae ON lae.listing_id = al.listing_id
        WHERE lae.created_at >= now() - interval '30 days'
        GROUP BY al.user_id
      )
      SELECT
        al.user_id,
        max(al.agent_name) AS agent_name,
        max(al.username) AS username,
        max(al.email) AS email,
        max(al.role) AS role,
        count(DISTINCT al.listing_id) FILTER (WHERE al.status = 'published')::int AS active_listings,
        coalesce(max(av.view_count), 0)::int AS view_count,
        coalesce(max(aa.action_count), 0)::int AS action_count,
        coalesce(max(aa.offer_count), 0)::int AS offer_count,
        (
          coalesce(max(av.view_count), 0)
          + coalesce(max(aa.action_count), 0) * 2
          + coalesce(max(aa.offer_count), 0) * 5
        )::int AS score
      FROM agent_listings al
      LEFT JOIN agent_views av ON av.user_id = al.user_id
      LEFT JOIN agent_actions aa ON aa.user_id = al.user_id
      GROUP BY al.user_id
      ORDER BY score DESC, view_count DESC, agent_name ASC
    `,
  ]);

  const branchColumns: Array<CanonicalTableColumn<BranchLeaderboardRow>> = [
    {
      header: "Rank",
      key: "rank",
      render: (row) => rankBadge(branchRows.findIndex((branch) => branch.branch_id === row.branch_id)),
    },
    {
      header: "Branch",
      key: "branch",
      render: (row) => (
        <div>
          <p className="font-semibold">{row.branch_name}</p>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {row.region || "No region set"}
          </p>
        </div>
      ),
    },
    {
      header: "Score",
      key: "score",
      render: (row) => <span className="font-semibold">{scoreLabel(row.score)}</span>,
    },
    {
      header: "Activity",
      key: "activity",
      render: (row) => (
        <div className="text-sm font-normal text-muted-foreground">
          <p>{scoreLabel(row.view_count)} views</p>
          <p>{scoreLabel(row.action_count)} actions</p>
        </div>
      ),
    },
    {
      header: "Footprint",
      key: "footprint",
      render: (row) => (
        <div className="text-sm font-normal text-muted-foreground">
          <p>{scoreLabel(row.agent_count)} agents</p>
          <p>{scoreLabel(row.active_listings)} listings</p>
        </div>
      ),
    },
  ];

  const agentColumns: Array<CanonicalTableColumn<AgentLeaderboardRow>> = [
    {
      header: "Rank",
      key: "rank",
      render: (row) => rankBadge(agentRows.findIndex((agent) => agent.user_id === row.user_id)),
    },
    {
      header: "Agent",
      key: "agent",
      render: (row) => (
        <div>
          <p className="font-semibold">{row.agent_name}</p>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            {row.username ? `@${row.username}` : row.email || "No username"}
          </p>
        </div>
      ),
    },
    {
      header: "Score",
      key: "score",
      render: (row) => <span className="font-semibold">{scoreLabel(row.score)}</span>,
    },
    {
      header: "Activity",
      key: "activity",
      render: (row) => (
        <div className="text-sm font-normal text-muted-foreground">
          <p>{scoreLabel(row.view_count)} views</p>
          <p>{scoreLabel(row.action_count)} actions</p>
        </div>
      ),
    },
    {
      header: "Listings",
      key: "listings",
      render: (row) => (
        <span className="text-sm font-normal text-muted-foreground">
          {scoreLabel(row.active_listings)} active
        </span>
      ),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Control room
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Leaderboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
            Rank performance using buyer views, high-intent actions, offer starts, active listings, and team footprint over the last 30 days.
            Independent agencies see their agents only; Network HQ workspaces also see branch rankings.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-normal text-muted-foreground shadow-sm">
          <ListOrdered className="size-4 text-primary" />
          Last 30 days
        </span>
      </div>

      {isNetwork ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">Branch leaderboard</h2>
          </div>
          <CanonicalTable
            columns={branchColumns}
            emptyState="No linked branch performance yet."
            getRowKey={(row) => row.branch_id}
            minWidth="760px"
            rows={branchRows}
          />
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <UserRound className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">Agent leaderboard</h2>
        </div>
        <CanonicalTable
          columns={agentColumns}
          emptyState="No agent performance yet."
          getRowKey={(row) => row.user_id}
          minWidth="760px"
          rows={agentRows}
        />
      </section>
    </main>
  );
}

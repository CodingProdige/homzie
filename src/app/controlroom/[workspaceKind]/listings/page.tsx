import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AgentProfileAvatar } from "@/components/agent-profile-avatar";
import { Button } from "@/components/ui/button";
import { CanonicalTable } from "@/components/ui/canonical-table";
import { sql } from "@/db";
import { updateAgencyListingStatus } from "@/modules/listings/agency-listing-actions";
import { getAgencyListingAccessForUser } from "@/modules/listings/agency-listing-access";
import { authOptions } from "@/modules/auth/config";

type AgencyListingRow = {
  assigned_agents: unknown;
  id: string;
  location: string | null;
  pending_request_count: number | string;
  price_label: string | null;
  status: string;
  title: string;
  updated_at: Date | string;
};

type AssignedAgent = {
  avatarUrl: string | null;
  name: string;
  role: string;
  userId: string;
  username: string | null;
};

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  if (status === "pending_approval") return "Pending approval";
  if (status === "under_offer") return "Under offer";
  if (status === "sold_externally") return "Sold externally";

  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusClassName(status: string) {
  if (status === "published") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "pending_approval") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (status === "under_offer") return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (status === "sold") return "bg-primary/10 text-primary";
  if (status === "archived") return "bg-muted text-muted-foreground";

  return "bg-muted text-muted-foreground";
}

function assignedAgents(value: unknown): AssignedAgent[] {
  return Array.isArray(value)
    ? value.filter((agent): agent is AssignedAgent =>
        Boolean(agent && typeof agent === "object" && "userId" in agent),
      )
    : [];
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value instanceof Date ? value : new Date(value));
}

function StatusActions({ listing }: { listing: AgencyListingRow }) {
  const actions = [
    ["published", "Publish"],
    ["under_offer", "Under offer"],
    ["sold", "Sold"],
    ["archived", "Archive"],
  ] as const;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {actions.map(([status, label]) => (
        <form key={status} action={updateAgencyListingStatus}>
          <input type="hidden" name="listingId" value={listing.id} />
          <input type="hidden" name="status" value={status} />
          <Button
            type="submit"
            variant={status === "archived" ? "outline" : "ghost"}
            className="h-8 px-2.5 text-xs"
            disabled={listing.status === status}
          >
            {label}
          </Button>
        </form>
      ))}
    </div>
  );
}

export default async function AgencyListingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/controlroom/agency/listings");
  }

  const access = await getAgencyListingAccessForUser(session.user.id);

  if (!access) {
    notFound();
  }

  const rows = await sql<AgencyListingRow[]>`
    WITH listing_scope AS (
      SELECT pl.*
      FROM property_listings pl
      WHERE pl.agency_id = ${access.agencyId}
        AND (
          ${access.canEditAgencyListings}
          OR EXISTS (
            SELECT 1
            FROM property_listing_agents pla_scope
            WHERE pla_scope.listing_id = pl.id
              AND pla_scope.user_id = ${session.user.id}
              AND pla_scope.removed_at IS NULL
          )
        )
    )
    SELECT
      ls.id,
      ls.title,
      ls.status,
      ls.location,
      ls.price_label,
      ls.updated_at,
      count(DISTINCT alr.id) FILTER (WHERE alr.status = 'pending')::int
        AS pending_request_count,
      coalesce(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'avatarUrl', u.avatar_url,
            'name', u.name,
            'role', pla.role,
            'userId', u.id,
            'username', u.username
          )
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'::jsonb
      ) AS assigned_agents
    FROM listing_scope ls
    LEFT JOIN property_listing_agents pla
      ON pla.listing_id = ls.id
      AND pla.removed_at IS NULL
    LEFT JOIN users u ON u.id = pla.user_id
    LEFT JOIN agency_listing_requests alr
      ON alr.listing_id = ls.id
      AND alr.status = 'pending'
    GROUP BY
      ls.id,
      ls.title,
      ls.status,
      ls.location,
      ls.price_label,
      ls.updated_at
    ORDER BY ls.updated_at DESC
  `;

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 text-foreground lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Agency inventory
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight lg:text-5xl">
            Listings
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-normal leading-6 text-muted-foreground">
            Create listings for your agency, assign agents, review approval state,
            and update listing outcomes for {access.agencyName}.
          </p>
        </div>
        {access.canCreateListings ? (
          <Button asChild>
            <Link href={`${access.basePath}/listings/new`}>New listing</Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-8">
        <CanonicalTable
          rows={rows}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `${access.basePath}/listings/${row.id}/edit`}
          minWidth="980px"
          emptyState="No agency listings have been created yet."
          columns={[
            {
              header: "Listing",
              key: "listing",
              render: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.title}</p>
                  <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
                    {row.location || "Location not set"}
                  </p>
                </div>
              ),
            },
            {
              header: "Status",
              key: "status",
              render: (row) => (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClassName(
                      row.status,
                    )}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                  {Number(row.pending_request_count || 0) ? (
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      Request pending
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              header: "Agents",
              key: "agents",
              render: (row) => {
                const agents = assignedAgents(row.assigned_agents);

                return agents.length ? (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {agents.slice(0, 4).map((agent) => (
                        <AgentProfileAvatar
                          key={agent.userId}
                          avatarUrl={agent.avatarUrl}
                          name={agent.name}
                          size="sm"
                        />
                      ))}
                    </div>
                    <span className="text-xs font-normal text-muted-foreground">
                      {agents.length === 1
                        ? agents[0].name
                        : `${agents.length} agents`}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">
                    No agents assigned
                  </span>
                );
              },
            },
            {
              header: "Price",
              key: "price",
              render: (row) => (
                <span className="font-semibold">{row.price_label || "No price"}</span>
              ),
            },
            {
              header: "Updated",
              key: "updated",
              render: (row) => (
                <span className="text-sm font-normal text-muted-foreground">
                  {formatDate(row.updated_at)}
                </span>
              ),
            },
            {
              header: "Actions",
              key: "actions",
              sticky: "right",
              useRowHref: false,
              render: (row) =>
                access.canEditAgencyListings ? <StatusActions listing={row} /> : null,
            },
          ]}
        />
      </div>
    </main>
  );
}

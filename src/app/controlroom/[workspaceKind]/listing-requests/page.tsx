import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AgentProfileAvatar } from "@/components/agent-profile-avatar";
import { Button } from "@/components/ui/button";
import { CanonicalTable } from "@/components/ui/canonical-table";
import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
import {
  approveAgencyListingRequest,
  rejectAgencyListingRequest,
} from "@/modules/listings/agency-listing-actions";
import { getAgencyListingAccessForUser } from "@/modules/listings/agency-listing-access";

type AgencyListingRequestRow = {
  agent_avatar_url: string | null;
  agent_name: string | null;
  agent_username: string | null;
  id: string;
  listing_id: string;
  listing_location: string | null;
  listing_status: string;
  listing_title: string;
  requested_at: Date | string;
  status: string;
};

export const dynamic = "force-dynamic";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value instanceof Date ? value : new Date(value));
}

function RequestActions({ request }: { request: AgencyListingRequestRow }) {
  if (request.status !== "pending") {
    return (
      <span className="text-xs font-semibold text-muted-foreground">
        {request.status.replace(/_/g, " ")}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <form action={rejectAgencyListingRequest}>
        <input type="hidden" name="requestId" value={request.id} />
        <Button type="submit" variant="outline" className="h-8 px-3 text-xs">
          Reject
        </Button>
      </form>
      <form action={approveAgencyListingRequest}>
        <input type="hidden" name="requestId" value={request.id} />
        <Button type="submit" className="h-8 px-3 text-xs">
          Approve
        </Button>
      </form>
    </div>
  );
}

export default async function AgencyListingRequestsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/controlroom/agency/listing-requests");
  }

  const access = await getAgencyListingAccessForUser(session.user.id);

  if (!access) {
    notFound();
  }

  const rows = await sql<AgencyListingRequestRow[]>`
    SELECT
      alr.id,
      alr.listing_id,
      alr.status,
      alr.requested_at,
      pl.title AS listing_title,
      pl.location AS listing_location,
      pl.status AS listing_status,
      requester.name AS agent_name,
      requester.username AS agent_username,
      requester.avatar_url AS agent_avatar_url
    FROM agency_listing_requests alr
    INNER JOIN property_listings pl ON pl.id = alr.listing_id
    LEFT JOIN users requester ON requester.id = alr.requested_by_user_id
    WHERE alr.agency_id = ${access.agencyId}
    ORDER BY
      CASE alr.status WHEN 'pending' THEN 0 ELSE 1 END,
      alr.requested_at DESC
  `;

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 text-foreground lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Listing approval
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight lg:text-5xl">
            Listing Requests
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-normal leading-6 text-muted-foreground">
            Review agent-submitted listings before they become public for{" "}
            {access.agencyName}.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`${access.basePath}/listings`}>View listings</Link>
        </Button>
      </div>

      <div className="mt-8">
        <CanonicalTable
          rows={rows}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `${access.basePath}/listings/${row.listing_id}/edit`}
          minWidth="880px"
          emptyState="No listing requests are waiting for review."
          columns={[
            {
              header: "Listing",
              key: "listing",
              render: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.listing_title}</p>
                  <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
                    {row.listing_location || "Location not set"}
                  </p>
                </div>
              ),
            },
            {
              header: "Submitted by",
              key: "agent",
              render: (row) => (
                <div className="flex min-w-0 items-center gap-2">
                  <AgentProfileAvatar
                    avatarUrl={row.agent_avatar_url}
                    name={row.agent_name}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {row.agent_name || "Agency agent"}
                    </p>
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {row.agent_username ? `@${row.agent_username}` : "No username"}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              header: "State",
              key: "state",
              render: (row) => (
                <div className="space-y-1">
                  <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    {row.status === "pending" ? "Pending review" : row.status}
                  </span>
                  <p className="text-xs font-normal text-muted-foreground">
                    Listing: {row.listing_status.replace(/_/g, " ")}
                  </p>
                </div>
              ),
            },
            {
              header: "Requested",
              key: "requested",
              render: (row) => (
                <span className="text-sm font-normal text-muted-foreground">
                  {formatDate(row.requested_at)}
                </span>
              ),
            },
            {
              header: "Actions",
              key: "actions",
              sticky: "right",
              useRowHref: false,
              render: (row) =>
                access.canReviewListingRequests ? (
                  <RequestActions request={row} />
                ) : null,
            },
          ]}
        />
      </div>
    </main>
  );
}

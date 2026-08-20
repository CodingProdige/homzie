import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import {
  CanonicalTable,
  type CanonicalTableColumn,
} from "@/components/ui/canonical-table";
import { sql } from "@/db";
import { toPublicMediaUrl } from "@/media/paths";
import { getAgentAccess } from "@/modules/access/agent-access";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import { getAgencyBuyerActivityAccessForUser } from "@/modules/listings/agency-buyer-activity";
import { clearListingBuyerActivityAction } from "@/modules/listings/activity-count-actions";
import {
  formatDateTime,
  PublicBuyerAvatar,
  TruncatedText,
} from "@/modules/listings/components/listing-activity-ui";
import { ListingPreviewCard } from "@/modules/listings/components/listing-preview-card";
import { ActivityRealtimeRefresh } from "@/modules/listings/components/activity-realtime-refresh";
import { LockedBuyerIntentPage } from "@/modules/listings/components/locked-buyer-intent-page";
import { ChatNowButton } from "@/modules/messages/components/chat-now-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listing Activity | Homzie",
  description:
    "Review anonymous listing activity and direct buyer conversations for your Homzie listing.",
};

type ListingActivityPageProps = {
  params: Promise<{ listingId: string }>;
  searchParams?: Promise<{ from?: string; page?: string }>;
};

type ListingActivityGroup = {
  actor_name: string | null;
  activity_count: number;
  avatar_url: string | null;
  buyer_id: string | null;
  latest_is_new: boolean;
  latest_seen_at: Date | string | null;
  username: string | null;
  viewer_key: string;
};

type AnonymousActivitySummary = {
  interaction_count: number;
  latest_seen_at: Date | string | null;
  unique_viewer_count: number;
  view_count: number;
};

function parsePage(value: string | undefined) {
  const page = Number(value || "1");

  if (!Number.isFinite(page) || page < 1) return 1;

  return Math.floor(page);
}

export default async function ListingActivityPage({
  params,
  searchParams,
}: ListingActivityPageProps) {
  const { listingId } = await params;
  const query = searchParams ? await searchParams : {};
  const currentPage = parsePage(query.page);
  const fromOverview = query.from === "overview";
  const fromControlRoom = query.from === "controlroom";
  const backHref = fromControlRoom
    ? "/controlroom/agency/buyer-activity"
    : fromOverview
      ? "/listings/activity"
      : `/listings/${listingId}`;
  const backLabel = fromControlRoom
    ? "Back to buyer activity"
    : fromOverview
      ? "Back to listing activity"
      : "Back to listing";
  const pageSize = 25;
  const offset = (currentPage - 1) * pageSize;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect(`/sign-in?callbackUrl=/listings/${listingId}/activity`);
  }

  const [viewer, listingRows, access, agencyActivityAccess] = await Promise.all([
    getViewerChrome(userId),
    sql<
      {
        agency_id: string | null;
        cover_image_url: string | null;
        id: string;
        location: string | null;
        price_label: string | null;
        status: string | null;
        title: string;
        user_id: string;
      }[]
    >`
      SELECT id, agency_id, user_id, title, location, cover_image_url, price_label, status
      FROM property_listings
      WHERE id = ${listingId}
      LIMIT 1
    `,
    getAgentAccess(userId),
    getAgencyBuyerActivityAccessForUser(userId),
  ]);
  const listing = listingRows[0];
  const hasAgencyActivityAccess = Boolean(
    agencyActivityAccess && listing?.agency_id === agencyActivityAccess.agencyId,
  );

  if (!listing || (listing.user_id !== userId && !hasAgencyActivityAccess)) {
    notFound();
  }

  if (!access.canViewBuyerIntent && !hasAgencyActivityAccess) {
    return (
      <LockedBuyerIntentPage
        backHref={`/listings/${listingId}`}
        viewerAvatarUrl={viewer.avatarUrl}
        viewerHasAgencyWorkspace={Boolean(viewer.hasAgencyWorkspace)}
        viewerName={viewer.name}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />
    );
  }

  const [countRows, activityGroups, unreadRows, anonymousActivityRows] = await Promise.all([
    sql<{ total_rows: number }[]>`
      SELECT count(DISTINCT viewer_user_id)::int AS total_rows
      FROM listing_action_events
      WHERE listing_id = ${listingId}
        AND action_type = 'contact_agent'
        AND viewer_user_id IS NOT NULL
        AND viewer_user_id <> ${userId}
    `,
    sql<ListingActivityGroup[]>`
      WITH contacted_buyers AS (
        SELECT
          viewer_user_id,
          count(*)::int AS contact_count,
          max(created_at) AS latest_contact_at
        FROM listing_action_events
        WHERE listing_id = ${listingId}
          AND action_type = 'contact_agent'
          AND viewer_user_id IS NOT NULL
          AND viewer_user_id <> ${userId}
        GROUP BY viewer_user_id
      )
      SELECT
        cb.viewer_user_id::text AS viewer_key,
        cb.contact_count AS activity_count,
        cb.latest_contact_at AS latest_seen_at,
        (lar.last_read_at IS NULL OR cb.latest_contact_at > lar.last_read_at) AS latest_is_new,
        u.id AS buyer_id,
        u.name AS actor_name,
        u.username,
        u.avatar_url
      FROM contacted_buyers cb
      JOIN users u ON u.id = cb.viewer_user_id
      LEFT JOIN listing_activity_reads lar
        ON lar.listing_id = ${listingId}
        AND lar.owner_user_id = ${userId}
        AND lar.viewer_key = cb.viewer_user_id::text
      ORDER BY
        (lar.last_read_at IS NULL OR cb.latest_contact_at > lar.last_read_at) DESC,
        cb.latest_contact_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `,
    sql<{ unread_viewer_count: number }[]>`
      WITH contacted_buyers AS (
        SELECT viewer_user_id, max(created_at) AS latest_contact_at
        FROM listing_action_events
        WHERE listing_id = ${listingId}
          AND action_type = 'contact_agent'
          AND viewer_user_id IS NOT NULL
          AND viewer_user_id <> ${userId}
        GROUP BY viewer_user_id
      )
      SELECT count(*) FILTER (
        WHERE lar.last_read_at IS NULL OR cb.latest_contact_at > lar.last_read_at
      )::int AS unread_viewer_count
      FROM contacted_buyers cb
      LEFT JOIN listing_activity_reads lar
        ON lar.listing_id = ${listingId}
        AND lar.owner_user_id = ${userId}
        AND lar.viewer_key = cb.viewer_user_id::text
    `,
    sql<AnonymousActivitySummary[]>`
      WITH passive_activity AS (
        SELECT
          coalesce(viewer_user_id::text, viewer_session_id) AS viewer_key,
          created_at,
          0::int AS interaction_count,
          1::int AS view_count
        FROM listing_view_events
        WHERE listing_id = ${listingId}
          AND (viewer_user_id IS NULL OR viewer_user_id <> ${userId})
        UNION ALL
        SELECT
          coalesce(viewer_user_id::text, viewer_session_id) AS viewer_key,
          created_at,
          1::int AS interaction_count,
          0::int AS view_count
        FROM listing_action_events
        WHERE listing_id = ${listingId}
          AND action_type <> 'contact_agent'
          AND (viewer_user_id IS NULL OR viewer_user_id <> ${userId})
      )
      SELECT
        count(DISTINCT viewer_key) FILTER (WHERE viewer_key IS NOT NULL)::int AS unique_viewer_count,
        coalesce(sum(view_count), 0)::int AS view_count,
        coalesce(sum(interaction_count), 0)::int AS interaction_count,
        max(created_at) AS latest_seen_at
      FROM passive_activity
    `,
  ]);

  const totalRows = countRows[0]?.total_rows || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const firstRow = totalRows ? offset + 1 : 0;
  const lastRow = Math.min(offset + activityGroups.length, totalRows);
  const unreadViewerCount = unreadRows[0]?.unread_viewer_count || 0;
  const anonymousActivity = anonymousActivityRows[0] || {
    interaction_count: 0,
    latest_seen_at: null,
    unique_viewer_count: 0,
    view_count: 0,
  };
  const activityHref = (path: string, page?: number) => {
    const params = new URLSearchParams();

    if (fromOverview) params.set("from", "overview");
    if (fromControlRoom) params.set("from", "controlroom");
    if (page && page > 1) params.set("page", String(page));

    const queryString = params.toString();

    return queryString ? `${path}?${queryString}` : path;
  };
  const listingPreview = {
    coverImageUrl: toPublicMediaUrl(listing.cover_image_url),
    id: listing.id,
    label: listing.title,
    location: listing.location,
    priceLabel: listing.price_label,
    status: listing.status,
    title: listing.title,
  };
  const activityColumns: Array<CanonicalTableColumn<ListingActivityGroup>> = [
    {
      className: "w-[62%] md:w-[31%]",
      header: "Contact-ready buyer",
      key: "buyer",
      render: (group) => {
        const buyerName = group.actor_name || "Homzie member";

        return (
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <PublicBuyerAvatar
              avatarPath={group.avatar_url}
              hasNewActivity={group.latest_is_new}
              name={buyerName}
            />
            <div className="min-w-0">
              <TruncatedText title={buyerName} className="font-medium">
                {buyerName}
              </TruncatedText>
              <TruncatedText
                title={group.username ? `@${group.username}` : "Contacted you"}
                className="mt-0.5 text-[10px] text-muted-foreground md:text-xs"
              >
                {group.username ? `@${group.username}` : "Contacted you"}
              </TruncatedText>
            </div>
          </div>
        );
      },
    },
    {
      className: "w-[20%] px-2 md:w-[14%] md:px-4",
      header: "Contacts",
      key: "events",
      render: (group) => (
        <TruncatedText title={`${group.activity_count} contact starts`}>
          <span className="md:hidden">{group.activity_count}</span>
          <span className="hidden md:inline">
            {group.activity_count} contact {group.activity_count === 1 ? "start" : "starts"}
          </span>
        </TruncatedText>
      ),
    },
    {
      className: "hidden w-[30%] md:table-cell",
      header: "Conversation",
      key: "latest",
      render: () => (
        <TruncatedText title="Started direct contact">
          Started direct contact
        </TruncatedText>
      ),
    },
    {
      className: "hidden w-[17%] md:table-cell",
      header: "Last contact",
      key: "last-active",
      render: (group) => {
        const label = formatDateTime(group.latest_seen_at);

        return (
          <TruncatedText title={label} className="text-muted-foreground">
            {label}
          </TruncatedText>
        );
      },
    },
    {
      className: "w-[14%] px-1.5 text-right md:w-[12%] md:px-4",
      header: "Chat",
      key: "action",
      render: (group) => (
        <ChatNowButton
          listingId={listing.id}
          mobileIconOnly
          recipientUserId={group.buyer_id}
          surface="activity-table"
        />
      ),
      useRowHref: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader
        viewerAvatarUrl={viewer.avatarUrl}
        viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace}
        viewerName={viewer.name}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-28">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-normal text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>

        <section className="mt-5 border-b border-border pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Listing activity
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
                Buyer conversations
              </h1>
            </div>
            <ActivityRealtimeRefresh />
          </div>
          <div className="mt-4 max-w-xl">
            <ListingPreviewCard listing={listingPreview} compact />
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Anonymous listing activity</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Passive browsing is kept anonymous. Only people who start direct contact with
                you appear in the buyer conversation list below.
              </p>
            </div>
            {anonymousActivity.latest_seen_at ? (
              <p className="text-xs text-muted-foreground">
                Last activity {formatDateTime(anonymousActivity.latest_seen_at)}
              </p>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted/45 px-4 py-3">
              <p className="text-2xl font-semibold">
                {anonymousActivity.unique_viewer_count}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Anonymous activity groups
              </p>
            </div>
            <div className="rounded-xl bg-muted/45 px-4 py-3">
              <p className="text-2xl font-semibold">{anonymousActivity.view_count}</p>
              <p className="mt-1 text-xs text-muted-foreground">Listing views</p>
            </div>
            <div className="rounded-xl bg-muted/45 px-4 py-3">
              <p className="text-2xl font-semibold">{anonymousActivity.interaction_count}</p>
              <p className="mt-1 text-xs text-muted-foreground">Other interactions</p>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {firstRow}-{lastRow} of {totalRows} contact-ready buyers
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <form action={clearListingBuyerActivityAction}>
                <input type="hidden" name="listingId" value={listing.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={unreadViewerCount <= 0}
                  className="h-8 rounded-full px-3 text-xs"
                >
                  Mark activity read
                </Button>
              </form>
              <p className="text-xs font-normal text-muted-foreground">
                Page {safeCurrentPage} of {totalPages}
              </p>
            </div>
          </div>

          <CanonicalTable
            columns={activityColumns}
            emptyState="No buyer has started direct contact from this listing yet."
            getRowHref={(group) =>
              activityHref(
                `/listings/${listing.id}/activity/${encodeURIComponent(group.viewer_key)}`,
              )
            }
            getRowKey={(group) => group.viewer_key}
            minWidth="0"
            pagination={{
              currentPage: safeCurrentPage,
              hrefForPage: (page) => activityHref(`/listings/${listing.id}/activity`, page),
              manual: true,
              pageSize,
              totalItems: totalRows,
            }}
            rows={activityGroups}
            tableClassName="table-fixed text-xs md:text-sm"
          />
        </section>
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}

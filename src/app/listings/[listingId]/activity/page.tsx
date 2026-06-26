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
import { clearListingBuyerActivityAction } from "@/modules/listings/activity-count-actions";
import {
  activityBadge,
  activityLabel,
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
  description: "Review realtime buyer activity for your Homzie listing.",
};

type ListingActivityPageProps = {
  params: Promise<{ listingId: string }>;
  searchParams?: Promise<{ from?: string; page?: string }>;
};

type ListingActivityGroup = {
  action_count: number;
  actor_name: string | null;
  activity_count: number;
  avatar_url: string | null;
  buyer_id: string | null;
  first_seen_at: Date | string | null;
  is_active: boolean;
  latest_action_type: string | null;
  latest_activity_type: "action" | "view";
  latest_is_new: boolean;
  latest_seen_at: Date | string | null;
  latest_session_id: string | null;
  latest_source: string | null;
  username: string | null;
  view_count: number;
  viewer_key: string;
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
  const backHref = fromOverview ? "/listings/activity" : `/listings/${listingId}`;
  const backLabel = fromOverview ? "Back to listing activity" : "Back to listing";
  const pageSize = 25;
  const offset = (currentPage - 1) * pageSize;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect(`/sign-in?callbackUrl=/listings/${listingId}/activity`);
  }

  const [viewer, listingRows, access] = await Promise.all([
    getViewerChrome(userId),
    sql<
      {
        cover_image_url: string | null;
        id: string;
        location: string | null;
        price_label: string | null;
        status: string | null;
        title: string;
        user_id: string;
      }[]
    >`
      SELECT id, user_id, title, location, cover_image_url, price_label, status
      FROM property_listings
      WHERE id = ${listingId}
      LIMIT 1
    `,
    getAgentAccess(userId),
  ]);
  const listing = listingRows[0];

  if (!listing || listing.user_id !== userId) {
    notFound();
  }

  if (!access.canViewBuyerIntent) {
    return (
      <LockedBuyerIntentPage
        backHref={`/listings/${listingId}`}
        viewerHasAgencyWorkspace={Boolean(viewer.hasAgencyWorkspace)}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />
    );
  }

  const [countRows, activityGroups, unreadRows] = await Promise.all([
    sql<{ total_rows: number }[]>`
      WITH activity_rows AS (
        SELECT coalesce(viewer_user_id::text, viewer_session_id) AS viewer_key
        FROM listing_view_events
        WHERE listing_id = ${listingId}
          AND (viewer_user_id IS NULL OR viewer_user_id <> ${userId})
        UNION ALL
        SELECT coalesce(viewer_user_id::text, viewer_session_id) AS viewer_key
        FROM listing_action_events
        WHERE listing_id = ${listingId}
          AND (viewer_user_id IS NULL OR viewer_user_id <> ${userId})
      )
      SELECT count(DISTINCT viewer_key)::int AS total_rows
      FROM activity_rows
      WHERE viewer_key IS NOT NULL
    `,
    sql<ListingActivityGroup[]>`
      WITH activity_rows AS (
        SELECT
          'view'::text AS activity_type,
          NULL::text AS action_type,
          lve.created_at,
          lve.source,
          lve.viewer_session_id,
          lve.viewer_user_id,
          coalesce(lve.view_instance_id, lve.viewer_session_id) AS view_key,
          coalesce(lve.viewer_user_id::text, lve.viewer_session_id) AS viewer_key
        FROM listing_view_events lve
        WHERE lve.listing_id = ${listingId}
          AND (lve.viewer_user_id IS NULL OR lve.viewer_user_id <> ${userId})
        UNION ALL
        SELECT
          'action'::text AS activity_type,
          lae.action_type,
          lae.created_at,
          lae.source,
          lae.viewer_session_id,
          lae.viewer_user_id,
          NULL::text AS view_key,
          coalesce(lae.viewer_user_id::text, lae.viewer_session_id) AS viewer_key
        FROM listing_action_events lae
        WHERE lae.listing_id = ${listingId}
          AND (lae.viewer_user_id IS NULL OR lae.viewer_user_id <> ${userId})
      ),
      grouped AS (
        SELECT
          viewer_key,
          (array_agg(viewer_user_id ORDER BY created_at DESC) FILTER (WHERE viewer_user_id IS NOT NULL))[1] AS viewer_user_id,
          (array_agg(viewer_session_id ORDER BY created_at DESC))[1] AS latest_session_id,
          count(*)::int AS activity_count,
          count(*) FILTER (WHERE activity_type = 'action')::int AS action_count,
          count(DISTINCT view_key) FILTER (WHERE activity_type = 'view')::int AS view_count,
          min(created_at) AS first_seen_at,
          max(created_at) AS latest_seen_at,
          (array_agg(activity_type ORDER BY created_at DESC))[1] AS latest_activity_type,
          (array_agg(action_type ORDER BY created_at DESC))[1] AS latest_action_type,
          (array_agg(source ORDER BY created_at DESC))[1] AS latest_source
        FROM activity_rows
        WHERE viewer_key IS NOT NULL
        GROUP BY viewer_key
      )
      SELECT
        g.viewer_key,
        g.activity_count,
        g.action_count,
        g.first_seen_at,
        g.latest_seen_at,
        (lar.last_read_at IS NULL OR g.latest_seen_at > lar.last_read_at) AS latest_is_new,
        g.latest_activity_type,
        g.latest_action_type,
        g.latest_source,
        g.latest_session_id,
        u.id AS buyer_id,
        u.name AS actor_name,
        u.username,
        u.avatar_url,
        g.view_count,
        EXISTS (
          SELECT 1
          FROM listing_presence_sessions lps
          WHERE lps.listing_id = ${listingId}
            AND (
              (g.viewer_user_id IS NOT NULL AND lps.viewer_user_id = g.viewer_user_id)
              OR lps.viewer_session_id = g.latest_session_id
            )
            AND lps.expires_at > now()
        ) AS is_active
      FROM grouped g
      LEFT JOIN users u ON u.id = g.viewer_user_id
      LEFT JOIN listing_activity_reads lar
        ON lar.listing_id = ${listingId}
        AND lar.owner_user_id = ${userId}
        AND lar.viewer_key = g.viewer_key
      ORDER BY
        (lar.last_read_at IS NULL OR g.latest_seen_at > lar.last_read_at) DESC,
        is_active DESC,
        g.latest_seen_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `,
    sql<{ unread_viewer_count: number }[]>`
      WITH activity_rows AS (
        SELECT
          coalesce(viewer_user_id::text, viewer_session_id) AS viewer_key,
          created_at
        FROM listing_view_events
        WHERE listing_id = ${listingId}
          AND (viewer_user_id IS NULL OR viewer_user_id <> ${userId})
        UNION ALL
        SELECT
          coalesce(viewer_user_id::text, viewer_session_id) AS viewer_key,
          created_at
        FROM listing_action_events
        WHERE listing_id = ${listingId}
          AND (viewer_user_id IS NULL OR viewer_user_id <> ${userId})
      ),
      viewer_latest AS (
        SELECT viewer_key, max(created_at) AS latest_seen_at
        FROM activity_rows
        WHERE viewer_key IS NOT NULL
        GROUP BY viewer_key
      )
      SELECT count(*) FILTER (
        WHERE lar.last_read_at IS NULL OR vl.latest_seen_at > lar.last_read_at
      )::int AS unread_viewer_count
      FROM viewer_latest vl
      LEFT JOIN listing_activity_reads lar
        ON lar.listing_id = ${listingId}
        AND lar.owner_user_id = ${userId}
        AND lar.viewer_key = vl.viewer_key
    `,
  ]);

  const totalRows = countRows[0]?.total_rows || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const firstRow = totalRows ? offset + 1 : 0;
  const lastRow = Math.min(offset + activityGroups.length, totalRows);
  const unreadViewerCount = unreadRows[0]?.unread_viewer_count || 0;
  const activityHref = (path: string, page?: number) => {
    const params = new URLSearchParams();

    if (fromOverview) params.set("from", "overview");
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
      header: "Buyer",
      key: "buyer",
      render: (group) => {
        const buyerName = group.actor_name || "Anonymous viewer";

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
                title={group.username ? `@${group.username}` : "Guest session"}
                className="mt-0.5 text-[10px] text-muted-foreground md:text-xs"
              >
                {group.username ? `@${group.username}` : "Guest"}
              </TruncatedText>
            </div>
          </div>
        );
      },
    },
    {
      className: "w-[20%] px-2 md:w-[14%] md:px-4",
      header: "Events",
      key: "events",
      render: (group) => (
        <>
          <TruncatedText title={`${group.activity_count} events`}>
            <span className="md:hidden">{group.activity_count}</span>
            <span className="hidden md:inline">{group.activity_count} events</span>
          </TruncatedText>
          <TruncatedText
            title={`${group.view_count} views`}
            className="mt-0.5 hidden text-xs text-muted-foreground md:block"
          >
            {group.view_count} views
          </TruncatedText>
        </>
      ),
    },
    {
      className: "hidden w-[30%] md:table-cell",
      header: "Latest",
      key: "latest",
      render: (group) => {
        const label = activityLabel({
          action_type: group.latest_action_type,
          activity_type: group.latest_activity_type,
        });
        const badge = activityBadge({
          action_type: group.latest_action_type,
          activity_type: group.latest_activity_type,
        });

        return (
          <>
            <TruncatedText title={label}>{label}</TruncatedText>
            <TruncatedText title={badge} className="mt-0.5 hidden text-xs text-muted-foreground md:block">
              {badge}
            </TruncatedText>
          </>
        );
      },
    },
    {
      className: "hidden w-[17%] md:table-cell",
      header: "Last active",
      key: "last-active",
      render: (group) => {
        const label = group.is_active ? "Active now" : formatDateTime(group.latest_seen_at);

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
      <GlobalHeader viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace} viewerRole={viewer.role} viewerUsername={viewer.username} />
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
                Buyer activity
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">
                Listing events
              </h1>
            </div>
            <ActivityRealtimeRefresh />
          </div>
          <div className="mt-4 max-w-xl">
            <ListingPreviewCard listing={listingPreview} compact />
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {firstRow}-{lastRow} of {totalRows} viewers
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
                  Clear all
                </Button>
              </form>
              <p className="text-xs font-normal text-muted-foreground">
                Page {safeCurrentPage} of {totalPages}
              </p>
            </div>
          </div>

          <CanonicalTable
            columns={activityColumns}
            emptyState="No buyer activity has been recorded yet."
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

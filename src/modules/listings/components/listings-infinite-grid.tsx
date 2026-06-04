"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { loadDiscoverListings } from "@/modules/listings/actions";
import { ListingCard, type ListingCardData } from "@/modules/listings/components/listing-card";
import type { DiscoverListingFilters } from "@/modules/listings/server/discover-listings";

type ListingsInfiniteGridProps = {
  filters?: DiscoverListingFilters;
  initialHasMore: boolean;
  initialListings: ListingCardData[];
  initialNextOffset: number;
  totalCount?: number;
};

export function ListingsInfiniteGrid({
  filters,
  initialHasMore,
  initialListings,
  initialNextOffset,
  totalCount,
}: ListingsInfiniteGridProps) {
  const [listings, setListings] = useState(initialListings);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(() => {
    if (!hasMore || isPending) return;

    startTransition(async () => {
      const data = await loadDiscoverListings({
        filters,
        limit: 8,
        offset: nextOffset,
      });

      setListings((current) => [...current, ...data.listings]);
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
    });
  }, [filters, hasMore, isPending, nextOffset]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: "480px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (!listings.length) return null;

  return (
    <div>
      {typeof totalCount === "number" ? (
        <div className="mb-4 flex flex-wrap gap-2 text-sm font-bold">
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {totalCount} {totalCount === 1 ? "result" : "results"}
          </span>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      {hasMore ? (
        <div ref={sentinelRef} className="mt-8 grid place-items-center">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={loadMore}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {isPending ? "Loading" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import {
  useCallback,
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
  loadMoreLimit?: number;
  totalCount?: number;
};

export function ListingsInfiniteGrid({
  filters,
  initialHasMore,
  initialListings,
  initialNextOffset,
  loadMoreLimit = 8,
  totalCount,
}: ListingsInfiniteGridProps) {
  const [listings, setListings] = useState(initialListings);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [isPending, startTransition] = useTransition();

  const loadMore = useCallback(() => {
    if (!hasMore || isPending) return;

    startTransition(async () => {
      const data = await loadDiscoverListings({
        filters,
        limit: loadMoreLimit,
        offset: nextOffset,
      });

      setListings((current) => [...current, ...data.listings]);
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
    });
  }, [filters, hasMore, isPending, loadMoreLimit, nextOffset]);

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
        <div className="mt-8 grid place-items-center">
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

import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ListingPreviewCardData = {
  coverImageUrl?: string | null;
  id?: string;
  label: string;
  location?: string | null;
  priceLabel?: string | null;
  status?: string | null;
  title?: string | null;
};

export function ListingPreviewCard({
  compact = false,
  listing,
}: {
  compact?: boolean;
  listing: ListingPreviewCardData;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background p-3 text-left",
        compact && "rounded-md p-2.5",
      )}
    >
      <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-muted/70">
        {listing.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Local listing preview image.
          <img
            src={listing.coverImageUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center bg-primary/10 text-primary">
            <ImageIcon className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold text-foreground">
          {listing.title || listing.label}
        </p>
        {listing.location ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {listing.location}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-normal text-muted-foreground">
          {listing.priceLabel ? <span>{listing.priceLabel}</span> : null}
          {listing.status ? (
            <span className="rounded-full bg-muted px-2 py-1 capitalize text-foreground/75">
              {listing.status}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

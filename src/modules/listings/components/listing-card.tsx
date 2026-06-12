"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Bath,
  BedDouble,
  Bookmark,
  Car,
  Heart,
  ParkingCircle,
  Play,
  Ruler,
  Trees,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  toggleListingLike,
  toggleListingSave,
  trackListingAction,
  trackListingView,
} from "@/modules/listings/actions";
import { useCurrency } from "@/modules/currency/currency-provider";
import { mandateTypeOptions, type ListingType } from "@/modules/listings/options";
import { countryFlagFromLocation } from "@/modules/location/country-preference";
import { getAnalyticsViewerSessionId } from "@/modules/analytics/browser-session";

export type ListingCardData = {
  bathrooms?: number | string | null;
  bedrooms?: number | string | null;
  buyerIncentive?: string | null;
  coverImageUrl?: string | null;
  erfSize?: number | string | null;
  features?: string[];
  floorSize?: number | string | null;
  footerText?: string;
  garages?: number | string | null;
  href?: string;
  id?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  likedByViewer?: boolean;
  likeCount?: number;
  likeCountLabel?: string;
  listingType: ListingType | string;
  listingTypeLabel: string;
  location?: string | null;
  mandateEndDate?: string | null;
  mandateStartDate?: string | null;
  mandateType?: string | null;
  parking?: number | string | null;
  previousPriceCents?: number | null;
  priceCents?: number | null;
  priceLabel?: string | null;
  pricePrefix?: string | null;
  propertyTypeLabel: string;
  isPromoted?: boolean;
  savedByViewer?: boolean;
  saveCount?: number;
  saveCountLabel?: string;
  status?: string | null;
  statusLabel?: string | null;
  title?: string | null;
  unavailable?: boolean;
  unavailableLabel?: string;
};

function featureHashtag(value: string) {
  return `#${value.replace(/\s+/g, "")}`;
}

function getMandateOption(value?: string | null) {
  return (
    mandateTypeOptions.find((option) => option.value === value) ||
    mandateTypeOptions[0]
  );
}

function formatMandateDates(startDate?: string | null, endDate?: string | null) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `Starts ${startDate}`;
  if (endDate) return `Ends ${endDate}`;

  return "Dates not set";
}

function formatMetric(value: ListingCardData["bedrooms"]) {
  return value || "0";
}

function ListingCardStat({
  icon: Icon,
  value,
}: {
  icon: typeof BedDouble;
  value: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{value}</span>
    </span>
  );
}

export function ListingSaveButton({
  className,
  countLabel,
  initialSaved = false,
  listingId,
  onSave,
  plain = false,
  showLabel = false,
}: {
  className?: string;
  countLabel?: string;
  initialSaved?: boolean;
  listingId: string;
  onSave?: (saved: boolean) => void;
  plain?: boolean;
  showLabel?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [label, setLabel] = useState(countLabel || "");
  const [pending, startTransition] = useTransition();

  function handleSave(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();

    const previous = saved;
    setSaved(!previous);

    startTransition(async () => {
      const result = await toggleListingSave(listingId);

      if (!result.ok) {
        setSaved(previous);
        return;
      }

      setSaved(result.saved);
      setLabel(result.countLabel);
      onSave?.(result.saved);
    });
  }

  return (
    <Button
      type="button"
      variant={plain ? "ghost" : "outline"}
      size={plain || showLabel || label ? "default" : "icon"}
      aria-label={saved ? "Remove saved listing" : "Save listing"}
      aria-pressed={saved}
      disabled={pending}
      className={cn(
        plain
          ? "h-auto gap-1.5 rounded-none bg-transparent p-0 text-sm font-black shadow-none hover:bg-transparent hover:text-primary"
          : showLabel
            ? "h-9"
            : label
              ? "h-9 gap-2 rounded-full bg-background/90 px-3 shadow-sm backdrop-blur hover:bg-background"
              : "size-9 rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background",
        saved &&
          (plain
            ? "text-brand-electric"
            : "border-brand-electric text-brand-electric"),
        className,
      )}
      onClick={handleSave}
    >
      <svg className="absolute size-0" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient
            id={`listing-save-gradient-${listingId}`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor="#6d3cff" />
            <stop offset="48%" stopColor="#7b5cff" />
            <stop offset="100%" stopColor="#ff3fb4" />
          </linearGradient>
        </defs>
      </svg>
      <Bookmark
        className={cn(
          "size-4",
          saved &&
            "text-brand-electric drop-shadow-[0_0_6px_rgba(255,63,180,0.55)]",
        )}
        style={saved ? { fill: `url(#listing-save-gradient-${listingId})` } : undefined}
      />
      {showLabel ? (saved ? "Saved" : "Save") : label ? <span>{label}</span> : null}
    </Button>
  );
}

export function ListingLikeButton({
  className,
  countLabel,
  initialLiked = false,
  listingId,
  onLike,
  plain = false,
  showLabel = false,
}: {
  className?: string;
  countLabel?: string;
  initialLiked?: boolean;
  listingId: string;
  onLike?: (liked: boolean) => void;
  plain?: boolean;
  showLabel?: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [label, setLabel] = useState(countLabel || "");
  const [pending, startTransition] = useTransition();

  function handleLike(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();

    const previous = liked;
    setLiked(!previous);

    startTransition(async () => {
      const result = await toggleListingLike(listingId);

      if (!result.ok) {
        setLiked(previous);
        return;
      }

      setLiked(result.liked);
      setLabel(result.countLabel);
      onLike?.(result.liked);
    });
  }

  return (
    <Button
      type="button"
      variant={plain ? "ghost" : "outline"}
      size={plain || showLabel || label ? "default" : "icon"}
      aria-label={liked ? "Unlike listing" : "Like listing"}
      aria-pressed={liked}
      disabled={pending}
      className={cn(
        plain
          ? "h-auto gap-1.5 rounded-none bg-transparent p-0 text-sm font-black shadow-none hover:bg-transparent hover:text-brand-pink"
          : showLabel
            ? "h-9"
            : label
              ? "h-9 gap-2 rounded-full bg-background/90 px-3 shadow-sm backdrop-blur hover:bg-background"
              : "size-9 rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background",
        liked && !plain && "border-red-500 text-red-500",
        liked && plain && "text-red-500",
        className,
      )}
      onClick={handleLike}
    >
      <Heart className={cn("size-4", liked && "fill-red-500 text-red-500")} />
      {showLabel ? (liked ? "Liked" : "Like") : label ? <span>{label}</span> : null}
    </Button>
  );
}

export function ListingEngagementActions({
  className,
  listing,
  likeDisabled = false,
  onLike,
  onSave,
  plain = false,
}: {
  className?: string;
  listing: Pick<
    ListingCardData,
    | "id"
    | "likedByViewer"
    | "likeCountLabel"
    | "savedByViewer"
    | "saveCountLabel"
  >;
  likeDisabled?: boolean;
  onLike?: (liked: boolean) => void;
  onSave?: (saved: boolean) => void;
  plain?: boolean;
}) {
  if (!listing.id) return null;

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      {likeDisabled ? null : (
        <ListingLikeButton
          countLabel={listing.likeCountLabel}
          initialLiked={listing.likedByViewer}
          listingId={listing.id}
          onLike={onLike}
          plain={plain}
        />
      )}
      <ListingSaveButton
        countLabel={listing.saveCountLabel}
        initialSaved={listing.savedByViewer}
        listingId={listing.id}
        onSave={onSave}
        plain={plain}
      />
    </div>
  );
}

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isVideoPreviewing, setIsVideoPreviewing] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);
  const hasTrackedHoverRef = useRef(false);
  const hasTrackedImpressionRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { formatPriceCents } = useCurrency();
  const imageUrls = Array.from(
    new Set([...(listing.coverImageUrl ? [listing.coverImageUrl] : []), ...(listing.imageUrls || [])]),
  ).filter(Boolean);
  const activeImageUrl = imageUrls[activeImageIndex] || listing.coverImageUrl;
  const videoUrl = listing.videoUrls?.[0] || "";
  const formattedPrice =
    listing.priceCents && listing.priceCents > 0
      ? formatPriceCents(listing.priceCents)
      : listing.priceLabel || "Price not set";
  const price =
    listing.listingType === "rental" && listing.priceCents && listing.priceCents > 0
      ? `${formattedPrice}/month`
      : formattedPrice;
  const showReducedPrice =
    Boolean(listing.priceCents) &&
    Number(listing.previousPriceCents || 0) > Number(listing.priceCents || 0);
  const mandateOption = getMandateOption(listing.mandateType);
  const MandateIcon = mandateOption.icon;
  const features = listing.features || [];
  const visibleFeatures = features.slice(0, 5);
  const hiddenFeatureCount = Math.max(features.length - visibleFeatures.length, 0);
  const unavailableLabel = listing.unavailableLabel || "No longer available";
  const isReserved = listing.status === "reserved";
  const statusLabel = listing.statusLabel || "Reserved";
  const isUnavailableButNotReserved = listing.unavailable && !isReserved;
  const locationFlag = countryFlagFromLocation(listing.location);

  function trackCardAction(actionType: "card_click" | "hover") {
    if (!listing.id || isUnavailableButNotReserved) return;

    void trackListingAction({
      actionType,
      listingId: listing.id,
      source: "listing_card",
      viewerSessionId: getAnalyticsViewerSessionId(),
    });
  }

  useEffect(() => {
    if (!listing.id || hasTrackedImpressionRef.current || isUnavailableButNotReserved) {
      return;
    }

    hasTrackedImpressionRef.current = true;
    void trackListingView({
      listingId: listing.id,
      source: "listing_card_impression",
      viewerSessionId: getAnalyticsViewerSessionId(),
    });
  }, [isUnavailableButNotReserved, listing.id]);

  useEffect(
    () => () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    },
    [],
  );

  function scheduleHoverTracking() {
    if (!listing.id || hasTrackedHoverRef.current || isUnavailableButNotReserved) {
      return;
    }

    hoverTimerRef.current = window.setTimeout(() => {
      hasTrackedHoverRef.current = true;
      trackCardAction("hover");
    }, 450);
  }

  function cancelHoverTracking() {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function stopVideoPreview() {
    setIsVideoPreviewing(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }

  function startVideoPreview() {
    if (!videoUrl || isUnavailableButNotReserved) return;

    setIsVideoPreviewing(true);
    void videoRef.current?.play().catch(() => {
      setIsVideoPreviewing(false);
    });
  }

  function handleImagePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (videoUrl || imageUrls.length <= 1) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const progress = Math.min(
      Math.max((event.clientX - rect.left) / rect.width, 0),
      0.999999,
    );

    setActiveImageIndex(Math.floor(progress * imageUrls.length));
  }

  const cardContent = (
    <>
      <div
        className="relative aspect-[4/3] bg-muted"
        onPointerMove={handleImagePointerMove}
        onPointerEnter={startVideoPreview}
        onPointerLeave={() => {
          setActiveImageIndex(0);
          stopVideoPreview();
        }}
        onFocus={startVideoPreview}
        onBlur={stopVideoPreview}
      >
        {activeImageUrl ? (
          <Image
            src={activeImageUrl}
            alt={listing.title || "Listing cover"}
            fill
            className={cn("object-cover", isUnavailableButNotReserved && "grayscale")}
          />
        ) : (
          <div
            className={cn(
              "grid size-full place-items-center text-muted-foreground",
              isUnavailableButNotReserved && "grayscale",
            )}
          >
            <Upload className="size-8" />
          </div>
        )}
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className={cn(
                "absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-200",
                (isVideoPreviewing || !activeImageUrl) && "opacity-100",
                isUnavailableButNotReserved && "grayscale",
              )}
              muted
              loop
              playsInline
              preload="metadata"
            />
            <span className="absolute left-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-foreground shadow-sm backdrop-blur">
              <Play className="size-3 fill-current" />
              Video
            </span>
          </>
        ) : null}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          <span className="rounded-full bg-background/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-foreground">
            {listing.listingTypeLabel}
          </span>
          {isReserved ? (
            <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-wide text-primary-foreground shadow-sm">
              {statusLabel}
            </span>
          ) : null}
        </div>
        {listing.buyerIncentive ? (
          <span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-primary px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-primary-foreground shadow-lg">
            {listing.buyerIncentive}
          </span>
        ) : null}
        {listing.id ? (
          <ListingEngagementActions
            className="absolute right-3 top-3 z-10"
            listing={listing}
            likeDisabled={isUnavailableButNotReserved}
          />
        ) : null}
        {isUnavailableButNotReserved ? (
          <div className="absolute inset-x-3 bottom-3 rounded-md bg-background/95 p-3 text-xs font-bold text-foreground shadow-lg backdrop-blur">
            <p className="font-black">{unavailableLabel}</p>
            <p className="mt-1 text-muted-foreground">
              This listing is not currently available.
            </p>
          </div>
        ) : null}
        {!videoUrl && imageUrls.length > 1 ? (
          <div
            className={
              listing.buyerIncentive
                ? "absolute inset-x-3 bottom-12 flex gap-1"
                : "absolute inset-x-3 bottom-3 flex gap-1"
            }
          >
            {imageUrls.map((imageUrl, index) => (
              <span
                key={`${imageUrl}-${index}`}
                className={`h-1 flex-1 rounded-full ${
                  index === activeImageIndex ? "bg-white" : "bg-white/45"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="p-4">
        {listing.isPromoted ? (
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Promoted
          </p>
        ) : null}
        <p className="text-xs font-black uppercase tracking-wide text-primary">
          {listing.propertyTypeLabel}
        </p>
        <h3 className="mt-1 line-clamp-2 text-lg font-black">
          {listing.title || "Your listing title"}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm font-bold text-muted-foreground">
          {locationFlag ? <span className="mr-1.5">{locationFlag}</span> : null}
          {listing.location || "Location not set"}
        </p>
        {listing.pricePrefix ? (
          <p className="mt-4 text-xs font-black uppercase tracking-wide text-primary">
            {listing.pricePrefix}
          </p>
        ) : null}
        <p className={listing.pricePrefix ? "mt-1 text-2xl font-black" : "mt-4 text-2xl font-black"}>
          {price}
        </p>
        {showReducedPrice ? (
          <p className="mt-1 text-xs font-black text-red-600">
            Reduced from{" "}
            <span className="text-muted-foreground line-through">
              {formatPriceCents(Number(listing.previousPriceCents))}
            </span>
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-black text-muted-foreground">
          <ListingCardStat
            icon={BedDouble}
            value={`${formatMetric(listing.bedrooms)} beds`}
          />
          <ListingCardStat
            icon={Bath}
            value={`${formatMetric(listing.bathrooms)} baths`}
          />
          <ListingCardStat
            icon={Car}
            value={`${formatMetric(listing.garages)} garages`}
          />
          <ListingCardStat
            icon={ParkingCircle}
            value={`${formatMetric(listing.parking)} parking`}
          />
          <ListingCardStat
            icon={Ruler}
            value={`${formatMetric(listing.floorSize)}m² floor`}
          />
          <ListingCardStat
            icon={Trees}
            value={`${formatMetric(listing.erfSize)}m² erf`}
          />
        </div>
        {visibleFeatures.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {visibleFeatures.map((feature) => (
              <span
                key={feature}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary"
              >
                {featureHashtag(feature)}
              </span>
            ))}
            {hiddenFeatureCount ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black text-muted-foreground">
                +{hiddenFeatureCount} more
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs font-bold text-muted-foreground">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-background text-primary">
            <MandateIcon className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="font-black text-foreground">{mandateOption.label}</p>
            <p className="mt-0.5">
              {formatMandateDates(
                listing.mandateStartDate,
                listing.mandateEndDate,
              )}
            </p>
          </div>
        </div>
        {listing.footerText ? (
          <p className="mt-4 text-xs font-semibold text-muted-foreground">
            {listing.footerText}
          </p>
        ) : null}
      </div>
    </>
  );

  if (listing.href) {
    return (
      <Link
        href={listing.href}
        className="group block overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={() => trackCardAction("card_click")}
        onPointerEnter={scheduleHoverTracking}
        onPointerLeave={cancelHoverTracking}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <article
      className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm"
      onPointerEnter={scheduleHoverTracking}
      onPointerLeave={cancelHoverTracking}
    >
      {cardContent}
    </article>
  );
}

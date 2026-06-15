import Image from "next/image";
import type { ReactNode } from "react";

import { toPublicMediaUrl } from "@/media/paths";

export type ListingActivityEventLike = {
  action_type: string | null;
  activity_type: "action" | "view";
};

export function initialsForName(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "B"
  );
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "Unknown";

  const date = value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatSource(value: string | null | undefined) {
  if (!value) return "Unknown";

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function activityLabel(event: ListingActivityEventLike) {
  if (event.activity_type === "view") return "Viewed the listing";

  switch (event.action_type) {
    case "bond_calculator":
      return "Opened bond calculator";
    case "call_agent":
      return "Tapped call agent";
    case "contact_agent":
      return "Started contact";
    case "email_agent":
      return "Tapped email agent";
    case "gallery_next":
    case "gallery_previous":
      return "Browsed listing photos";
    case "like":
      return "Liked the listing";
    case "media_thumbnail":
      return "Opened listing media";
    case "media_video_play":
      return "Played listing video";
    case "place_offer":
      return "Started an offer";
    case "reserve_now":
      return "Started reservation";
    case "save":
      return "Saved the listing";
    case "share":
      return "Shared the listing";
    case "whatsapp_agent":
      return "Tapped WhatsApp";
    default:
      return "Interacted with listing";
  }
}

export function activityBadge(event: ListingActivityEventLike) {
  if (event.activity_type === "view") return "View";

  switch (event.action_type) {
    case "bond_calculator":
    case "like":
    case "place_offer":
    case "reserve_now":
    case "save":
      return "Intent";
    case "call_agent":
    case "contact_agent":
    case "email_agent":
    case "whatsapp_agent":
      return "Contact";
    default:
      return "Action";
  }
}

export function BuyerAvatar({
  avatarUrl,
  hasNewActivity = false,
  name,
}: {
  avatarUrl: string | null;
  hasNewActivity?: boolean;
  name: string;
}) {
  const newIndicator = hasNewActivity ? (
    <span
      aria-label="New activity"
      className="absolute -left-0.5 -top-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-card"
      title="New activity"
    />
  ) : null;

  if (avatarUrl) {
    return (
      <span className="relative shrink-0">
        {newIndicator}
        <Image
          src={avatarUrl}
          alt=""
          width={40}
          height={40}
          className="size-9 rounded-full object-cover sm:size-10"
        />
      </span>
    );
  }

  return (
    <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground sm:size-10">
      {newIndicator}
      <span>{initialsForName(name)}</span>
    </span>
  );
}

export function PublicBuyerAvatar({
  avatarPath,
  hasNewActivity = false,
  name,
}: {
  avatarPath: string | null;
  hasNewActivity?: boolean;
  name: string;
}) {
  return (
    <BuyerAvatar
      avatarUrl={toPublicMediaUrl(avatarPath)}
      hasNewActivity={hasNewActivity}
      name={name}
    />
  );
}

export function TruncatedText({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <span className={`block truncate whitespace-nowrap ${className}`} title={title}>
      {children}
    </span>
  );
}

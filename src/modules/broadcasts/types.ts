export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export type BroadcastAudienceRole =
  | "all"
  | "home_seeker"
  | "private_seller"
  | "property_agent"
  | "developer";

export type BroadcastAudience = {
  country?: string;
  createdAfter?: string;
  createdBefore?: string;
  hasListings?: boolean;
  hasReels?: boolean;
  province?: string;
  role?: BroadcastAudienceRole;
};

type BaseBlock = {
  id: string;
};

export type BroadcastHeroBlock = BaseBlock & {
  body?: string;
  eyebrow?: string;
  title: string;
  type: "hero";
};

export type BroadcastTextBlock = BaseBlock & {
  body: string;
  type: "text";
};

export type BroadcastImageBlock = BaseBlock & {
  alt?: string;
  type: "image";
  url: string;
};

export type BroadcastButtonBlock = BaseBlock & {
  href: string;
  label: string;
  type: "button";
};

export type BroadcastListingBlock = BaseBlock & {
  href?: string;
  imageUrl?: string;
  location?: string;
  price?: string;
  title: string;
  type: "listing";
};

export type BroadcastAgentBlock = BaseBlock & {
  avatarUrl?: string;
  headline?: string;
  href?: string;
  name: string;
  type: "agent";
};

export type BroadcastDividerBlock = BaseBlock & {
  type: "divider";
};

export type BroadcastFooterBlock = BaseBlock & {
  body: string;
  type: "footer";
};

export type BroadcastBlock =
  | BroadcastAgentBlock
  | BroadcastButtonBlock
  | BroadcastDividerBlock
  | BroadcastFooterBlock
  | BroadcastHeroBlock
  | BroadcastImageBlock
  | BroadcastListingBlock
  | BroadcastTextBlock;

export type BroadcastRecipient = {
  email: string;
  name: string | null;
  userId: string;
};

export const defaultBroadcastBlocks: BroadcastBlock[] = [
  {
    body: "Share the update in plain language. Keep it short, useful, and easy to act on.",
    eyebrow: "Homzie update",
    id: "hero-1",
    title: "A fresh Homzie update",
    type: "hero",
  },
  {
    body: "Tell users what changed, why it matters, and what they should do next.",
    id: "text-1",
    type: "text",
  },
  {
    href: "/",
    id: "button-1",
    label: "Open Homzie",
    type: "button",
  },
];

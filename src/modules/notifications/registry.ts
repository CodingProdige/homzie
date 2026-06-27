export type NotificationPreferenceCategory =
  | "listingActivity"
  | "messages"
  | "profileActivity"
  | "reelActivity";

export type NotificationTemplateContext = {
  actor: {
    name: string;
    username?: string | null;
  };
  app: {
    name: string;
    url: string;
  };
  conversation?: {
    url?: string | null;
  };
  agency?: {
    actionLabel?: string | null;
    actionUrl?: string | null;
    name?: string | null;
    networkName?: string | null;
    requestingName?: string | null;
    url?: string | null;
  };
  event: {
    activeViewerCount?: number | null;
    count?: number | null;
    reason?: string | null;
    type: string;
  };
  listing?: {
    title?: string | null;
    url?: string | null;
  };
  message?: {
    preview?: string | null;
  };
  offer?: {
    amount?: string | null;
  };
  reel?: {
    title?: string | null;
    url?: string | null;
  };
};

export type NotificationRegistryItem = {
  category: string;
  defaultEmailEnabled: boolean;
  defaultPushEnabled: boolean;
  emailTemplateKey: string;
  eventType: string;
  label: string;
  preferenceCategory: NotificationPreferenceCategory;
  pushBody: string;
  pushTitle: string;
  template: string;
};

export const notificationRegistry = [
  {
    category: "Control room",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "agency.network_link.requested",
    eventType: "agency.network_link.requested",
    label: "Network link requested",
    preferenceCategory: "messages",
    pushBody: "{{agency.requestingName}} wants to link to {{agency.networkName}}.",
    pushTitle: "New branch request",
    template:
      "{{agency.requestingName}} requested to link to {{agency.networkName}}. Review the request in your control room.",
  },
  {
    category: "Control room",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "agency.network_link.approved",
    eventType: "agency.network_link.approved",
    label: "Network link approved",
    preferenceCategory: "messages",
    pushBody: "{{agency.networkName}} approved your network link.",
    pushTitle: "Network request approved",
    template:
      "{{agency.networkName}} approved your request. Your agency is now linked to the network.",
  },
  {
    category: "Control room",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "agency.network_link.declined",
    eventType: "agency.network_link.declined",
    label: "Network link declined",
    preferenceCategory: "messages",
    pushBody: "{{agency.networkName}} declined your network link request.",
    pushTitle: "Network request declined",
    template:
      "{{agency.networkName}} declined your request. You can review your network settings in the control room.",
  },
  {
    category: "Control room",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "agency.network_link.left",
    eventType: "agency.network_link.left",
    label: "Branch left network",
    preferenceCategory: "messages",
    pushBody: "{{agency.requestingName}} left {{agency.networkName}}.",
    pushTitle: "Branch left network",
    template:
      "{{agency.requestingName}} left {{agency.networkName}}. The branch is now independent.",
  },
  {
    category: "Offers",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "offer.created",
    eventType: "offer.created",
    label: "New offer",
    preferenceCategory: "messages",
    pushBody: "{{actor.name}} made an offer {{offer.amount}}.",
    pushTitle: "New offer",
    template:
      "{{actor.name}} made an offer {{offer.amount}} on {{listing.title}}.",
  },
  {
    category: "Offers",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "offer.accepted",
    eventType: "offer.accepted",
    label: "Offer accepted",
    preferenceCategory: "messages",
    pushBody: "{{actor.name}} accepted your offer {{offer.amount}}.",
    pushTitle: "Offer accepted",
    template:
      "{{actor.name}} accepted your offer {{offer.amount}} on {{listing.title}}.",
  },
  {
    category: "Offers",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "offer.declined",
    eventType: "offer.declined",
    label: "Offer declined",
    preferenceCategory: "messages",
    pushBody: "{{actor.name}} declined your offer {{offer.amount}}.",
    pushTitle: "Offer declined",
    template:
      "{{actor.name}} declined your offer {{offer.amount}} on {{listing.title}}.",
  },
  {
    category: "Messages",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "message.created",
    eventType: "message.created",
    label: "New message",
    preferenceCategory: "messages",
    pushBody: "{{message.preview}}",
    pushTitle: "New message from {{actor.name}}",
    template: "{{actor.name}} sent you a message.",
  },
  {
    category: "Profile",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "profile.followed",
    eventType: "profile.followed",
    label: "New follower",
    preferenceCategory: "profileActivity",
    pushBody: "{{actor.name}} followed your profile.",
    pushTitle: "New follower",
    template: "{{actor.name}} followed your profile.",
  },
  {
    category: "Listings",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "listing.liked",
    eventType: "listing.liked",
    label: "Listing liked",
    preferenceCategory: "listingActivity",
    pushBody: "{{actor.name}} liked {{listing.title}}.",
    pushTitle: "Listing liked",
    template: "{{actor.name}} liked {{listing.title}}.",
  },
  {
    category: "Listings",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "listing.saved",
    eventType: "listing.saved",
    label: "Listing saved",
    preferenceCategory: "listingActivity",
    pushBody: "{{actor.name}} saved {{listing.title}}.",
    pushTitle: "Listing saved",
    template: "{{actor.name}} saved {{listing.title}}.",
  },
  {
    category: "Listings",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "listing.contacted",
    eventType: "listing.contacted",
    label: "Listing contact",
    preferenceCategory: "listingActivity",
    pushBody: "{{actor.name}} contacted you about {{listing.title}}.",
    pushTitle: "Listing enquiry",
    template: "{{actor.name}} contacted you about {{listing.title}}.",
  },
  {
    category: "Buyer intent",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "listing.buyer_activity",
    eventType: "listing.buyer_activity",
    label: "Buyer activity",
    preferenceCategory: "listingActivity",
    pushBody: "{{event.reason}} on {{listing.title}}.",
    pushTitle: "New buyer activity",
    template: "{{event.reason}} on {{listing.title}}.",
  },
  {
    category: "Listings",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "listing.views.milestone",
    eventType: "listing.views.milestone",
    label: "Listing view milestone",
    preferenceCategory: "listingActivity",
    pushBody: "{{listing.title}} reached {{event.count}} views.",
    pushTitle: "Listing views milestone",
    template: "{{listing.title}} reached {{event.count}} views.",
  },
  {
    category: "Buyer intent",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "listing.buyer_intent.repeat_view",
    eventType: "listing.buyer_intent.repeat_view",
    label: "Repeat buyer view",
    preferenceCategory: "listingActivity",
    pushBody: "{{actor.name}} is viewing {{listing.title}} again.",
    pushTitle: "Buyer viewing now",
    template:
      "{{actor.name}} is viewing {{listing.title}}. Open the listing to start a chat while they are active.",
  },
  {
    category: "Buyer intent",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "listing.buyer_intent.active_viewer",
    eventType: "listing.buyer_intent.active_viewer",
    label: "Active listing viewer",
    preferenceCategory: "listingActivity",
    pushBody: "A buyer is viewing {{listing.title}} right now.",
    pushTitle: "Buyer active now",
    template:
      "A buyer is viewing {{listing.title}} right now. Open the listing to see buyer intent.",
  },
  {
    category: "Buyer intent",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "listing.buyer_intent.active_viewers",
    eventType: "listing.buyer_intent.active_viewers",
    label: "Active listing viewers",
    preferenceCategory: "listingActivity",
    pushBody: "{{listing.title}} has {{event.activeViewerCount}} active viewers.",
    pushTitle: "Buyers active now",
    template:
      "{{listing.title}} has {{event.activeViewerCount}} active viewers right now. Open the listing to see buyer intent.",
  },
  {
    category: "Listings",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "listing.reserved",
    eventType: "listing.reserved",
    label: "Listing reserved",
    preferenceCategory: "listingActivity",
    pushBody: "{{actor.name}} reserved {{listing.title}}.",
    pushTitle: "Listing reserved",
    template: "{{actor.name}} reserved {{listing.title}}.",
  },
  {
    category: "Reels",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "reel.liked",
    eventType: "reel.liked",
    label: "Reel liked",
    preferenceCategory: "reelActivity",
    pushBody: "{{actor.name}} liked {{reel.title}}.",
    pushTitle: "Reel liked",
    template: "{{actor.name}} liked {{reel.title}}.",
  },
  {
    category: "Reels",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "reel.saved",
    eventType: "reel.saved",
    label: "Reel saved",
    preferenceCategory: "reelActivity",
    pushBody: "{{actor.name}} saved {{reel.title}}.",
    pushTitle: "Reel saved",
    template: "{{actor.name}} saved {{reel.title}}.",
  },
  {
    category: "Reels",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "reel.reshared",
    eventType: "reel.reshared",
    label: "Reel reshared",
    preferenceCategory: "reelActivity",
    pushBody: "{{actor.name}} reshared {{reel.title}}.",
    pushTitle: "Reel reshared",
    template: "{{actor.name}} reshared {{reel.title}}.",
  },
  {
    category: "Reels",
    defaultEmailEnabled: true,
    defaultPushEnabled: true,
    emailTemplateKey: "reel.views.milestone",
    eventType: "reel.views.milestone",
    label: "Reel view milestone",
    preferenceCategory: "reelActivity",
    pushBody: "{{reel.title}} reached {{event.count}} views.",
    pushTitle: "Reel views milestone",
    template: "{{reel.title}} reached {{event.count}} views.",
  },
  {
    category: "Moderation",
    defaultEmailEnabled: false,
    defaultPushEnabled: false,
    emailTemplateKey: "report.created",
    eventType: "report.created",
    label: "Report received",
    preferenceCategory: "messages",
    pushBody: "Your report was received.",
    pushTitle: "Report received",
    template: "Your report was received.",
  },
] as const satisfies readonly NotificationRegistryItem[];

export type NotificationEventType =
  (typeof notificationRegistry)[number]["eventType"];

export function getNotificationDefinition(eventType: string) {
  return notificationRegistry.find((item) => item.eventType === eventType) || null;
}

function valueAtPath(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, source);
}

export function renderNotificationTemplate(
  template: string,
  context: NotificationTemplateContext,
) {
  return template
    .replace(/{{\s*([^}]+)\s*}}/g, (_match, key: string) => {
      const value = valueAtPath(context, key.trim());

      if (value === null || typeof value === "undefined" || value === "") {
        return "";
      }

      return String(value);
    })
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

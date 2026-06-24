import { notificationRegistry } from "@/modules/notifications/registry";

const notificationEmailEventsByCategory = notificationRegistry.reduce(
  (groups, event) => {
    const existing = groups.get(event.category) || {
      category: event.category,
      description: `${event.category} notification emails.`,
      events: [],
    };

    existing.events.push({
      defaultEnabled: event.defaultEmailEnabled,
      key: event.emailTemplateKey,
      label: event.label,
    });
    groups.set(event.category, existing);

    return groups;
  },
  new Map<
    string,
    {
      category: string;
      description: string;
      events: Array<{ defaultEnabled: boolean; key: string; label: string }>;
    }
  >(),
);

export const emailNotificationEvents = [
  {
    category: "Account",
    description: "Welcome, security, and important account emails.",
    events: [
      { defaultEnabled: true, key: "auth.welcome", label: "Welcome email" },
      {
        defaultEnabled: true,
        key: "security.password_reset_requested",
        label: "Password reset link",
      },
      {
        defaultEnabled: true,
        key: "security.password_changed",
        label: "Password changed",
      },
    ],
  },
  {
    category: "Property activity",
    description: "Listings and reels from profiles someone follows.",
    events: [
      {
        defaultEnabled: true,
        key: "listing.new_from_followed_profile",
        label: "New listing from followed profile",
      },
      {
        defaultEnabled: true,
        key: "reel.new_from_followed_profile",
        label: "New reel from followed profile",
      },
      {
        defaultEnabled: true,
        key: "listing.reservation_document_request",
        label: "Reservation document request",
      },
    ],
  },
  {
    category: "Billing",
    description: "Subscription, invoice, and payment emails.",
    events: [
      {
        defaultEnabled: true,
        key: "billing.subscription_trial_started",
        label: "Agent trial started",
      },
      {
        defaultEnabled: true,
        key: "billing.subscription_trial_incomplete",
        label: "Trial setup incomplete",
      },
      {
        defaultEnabled: true,
        key: "billing.subscription_active",
        label: "Subscription active",
      },
      { defaultEnabled: true, key: "billing.invoice_paid", label: "Invoice paid" },
      { defaultEnabled: true, key: "billing.payment_failed", label: "Payment failed" },
    ],
  },
  {
    category: "Ads",
    description: "Campaign publishing and campaign health emails.",
    events: [
      {
        defaultEnabled: true,
        key: "ads.campaign_published",
        label: "Campaign published",
      },
      {
        defaultEnabled: true,
        key: "ads.campaign_needs_attention",
        label: "Campaign needs attention",
      },
    ],
  },
  {
    category: "Support",
    description: "Contact form and support acknowledgement emails.",
    events: [
      {
        defaultEnabled: true,
        key: "support.contact_received",
        label: "Support contact received",
      },
      {
        defaultEnabled: true,
        key: "support.contact_confirmation",
        label: "Support confirmation",
      },
    ],
  },
  ...notificationEmailEventsByCategory.values(),
] as const;

export const emailNotificationEventKeys = emailNotificationEvents.flatMap((group) =>
  group.events.map((event) => event.key),
);

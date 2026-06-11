export const emailNotificationEvents = [
  {
    category: "Account",
    description: "Welcome, security, and important account emails.",
    events: [
      { key: "auth.welcome", label: "Welcome email" },
      { key: "security.password_reset_requested", label: "Password reset link" },
      { key: "security.password_changed", label: "Password changed" },
    ],
  },
  {
    category: "Property activity",
    description: "Listings and reels from profiles someone follows.",
    events: [
      {
        key: "listing.new_from_followed_profile",
        label: "New listing from followed profile",
      },
      {
        key: "reel.new_from_followed_profile",
        label: "New reel from followed profile",
      },
    ],
  },
  {
    category: "Messages",
    description: "Conversation and enquiry emails.",
    events: [{ key: "message.new", label: "New message" }],
  },
  {
    category: "Billing",
    description: "Subscription, invoice, and payment emails.",
    events: [
      { key: "billing.subscription_trial_started", label: "Agent trial started" },
      { key: "billing.subscription_active", label: "Subscription active" },
      { key: "billing.invoice_paid", label: "Invoice paid" },
      { key: "billing.payment_failed", label: "Payment failed" },
    ],
  },
  {
    category: "Ads",
    description: "Campaign publishing and campaign health emails.",
    events: [
      { key: "ads.campaign_published", label: "Campaign published" },
      { key: "ads.campaign_needs_attention", label: "Campaign needs attention" },
    ],
  },
  {
    category: "Support",
    description: "Contact form and support acknowledgement emails.",
    events: [
      { key: "support.contact_received", label: "Support contact received" },
      { key: "support.contact_confirmation", label: "Support confirmation" },
    ],
  },
] as const;

export const emailNotificationEventKeys = emailNotificationEvents.flatMap((group) =>
  group.events.map((event) => event.key),
);

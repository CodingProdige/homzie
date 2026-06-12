import "server-only";

export type EmailTemplateVariable = {
  key: string;
  label: string;
  fallback?: string;
};

export type DefaultEmailTemplate = {
  category: string;
  description: string;
  enabled: boolean;
  html: string;
  key: string;
  name: string;
  preheader: string;
  sampleVariables: Record<string, unknown>;
  subject: string;
  text: string;
  variables: EmailTemplateVariable[];
};

const commonVariables: EmailTemplateVariable[] = [
  { key: "app.name", label: "App name", fallback: "Homzie" },
  { key: "app.url", label: "App URL", fallback: "https://homzie.co.za" },
];

export const defaultEmailTemplates = [
  {
    category: "Auth",
    description: "Sent after a user creates an account with email and password.",
    enabled: true,
    html: `
      <h1>Welcome to {{app.name}}, {{user.firstName}}</h1>
      <p>You are in. Start saving homes, following agents, watching property reels, and keeping your property journey in one place.</p>
      <p>Agents use Homzie to showcase listings and reels with context buyers can actually act on. Buyers use it to discover trusted profiles and homes faster.</p>
      <p><a class="button" href="{{dashboardUrl}}">Open Homzie</a></p>
    `,
    key: "auth.welcome",
    name: "Welcome after registration",
    preheader: "Your Homzie account is ready.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      dashboardUrl: "https://homzie.co.za",
      user: { firstName: "Dillon", name: "Dillon Jurgens" },
    },
    subject: "Welcome to {{app.name}}, {{user.firstName}}",
    text: "Welcome to {{app.name}}, {{user.firstName}}. Your account is ready: {{dashboardUrl}}",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "user.name", label: "Recipient full name" },
      { key: "dashboardUrl", label: "Dashboard URL" },
    ],
  },
  {
    category: "Listings",
    description: "Sent to followers when an agent they follow publishes a listing.",
    enabled: true,
    html: `
      <h1>{{agent.name}} just published a new listing</h1>
      <p>{{listing.title}} is now live on {{app.name}}.</p>
      <p><strong>{{listing.priceLabel}}</strong><br />{{listing.location}}</p>
      <p><a class="button" href="{{listing.url}}">View listing</a></p>
      <p class="muted">You are receiving this because you follow {{agent.name}}.</p>
    `,
    key: "listing.new_from_followed_profile",
    name: "New listing from followed profile",
    preheader: "{{agent.name}} published {{listing.title}}.",
    sampleVariables: {
      agent: { name: "Ava Morgan", username: "avamorgan" },
      app: { name: "Homzie", url: "https://homzie.co.za" },
      listing: {
        location: "Camps Bay, Cape Town",
        priceLabel: "R 4,250,000",
        title: "Modern coastal home",
        url: "https://homzie.co.za/property/for-sale/western-cape/paarl/3-bedroom-house-in-val-de-vie-00000000",
      },
      user: { firstName: "Sam", name: "Sam Buyer" },
    },
    subject: "New listing from {{agent.name}}: {{listing.title}}",
    text: "{{agent.name}} published {{listing.title}} on {{app.name}}. View it: {{listing.url}}",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "agent.name", label: "Agent name" },
      { key: "agent.username", label: "Agent username" },
      { key: "listing.title", label: "Listing title" },
      { key: "listing.location", label: "Listing location" },
      { key: "listing.priceLabel", label: "Listing price label" },
      { key: "listing.url", label: "Listing URL" },
    ],
  },
  {
    category: "Reservations",
    description:
      "Sent to an agent after a buyer pays to reserve one of their listings.",
    enabled: true,
    html: `
      <h1>Your listing has received a reservation</h1>
      <p><strong>{{listing.title}}</strong> has been reserved on {{app.name}}.</p>
      <p>The buyer paid <strong>{{reservation.totalPaid}}</strong>. The agency reservation amount is <strong>{{reservation.amount}}</strong>.</p>
      <p>Before Homzie records any off-app release of funds, please send the required documents to the Homzie team.</p>
      <ul>
        <li>Signed mandate or authority to market this property.</li>
        <li>Agency registration document or proof of trading entity.</li>
        <li>Agency bank confirmation letter.</li>
        <li>Written approval from the agency principal, director, or authorized manager.</li>
        <li>Instruction or invoice confirming the agency may receive the reservation funds.</li>
      </ul>
      <p><a class="button" href="{{reservation.adminUrl}}">View reservation</a></p>
      <p class="muted">Funds must only be released to a verified agency or business account after admin approval.</p>
    `,
    key: "listing.reservation_document_request",
    name: "Reservation document request",
    preheader: "{{listing.title}} has been reserved. Documentation is required.",
    sampleVariables: {
      agent: { name: "Ava Morgan", username: "avamorgan" },
      app: { name: "Homzie", url: "https://homzie.co.za" },
      listing: {
        location: "Camps Bay, Cape Town",
        title: "Modern coastal home",
        url: "https://homzie.co.za/property/for-sale/western-cape/paarl/3-bedroom-house-in-val-de-vie-00000000",
      },
      reservation: {
        adminUrl:
          "https://homzie.co.za/admin/reservations?reservation=00000000-0000-0000-0000-000000000000",
        amount: "R 10,000",
        totalPaid: "R 10,840",
      },
      user: { firstName: "Ava", name: "Ava Morgan" },
    },
    subject: "Reservation received for {{listing.title}}",
    text: "{{listing.title}} has been reserved on {{app.name}}. Send mandate, agency registration, bank confirmation, principal approval, and reservation authority documents before funds can be released. View: {{reservation.adminUrl}}",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "agent.name", label: "Agent name" },
      { key: "agent.username", label: "Agent username" },
      { key: "listing.title", label: "Listing title" },
      { key: "listing.location", label: "Listing location" },
      { key: "listing.url", label: "Listing URL" },
      { key: "reservation.amount", label: "Reservation amount" },
      { key: "reservation.totalPaid", label: "Total paid" },
      { key: "reservation.adminUrl", label: "Admin reservation URL" },
    ],
  },
  {
    category: "Messages",
    description: "Sent when someone receives a new conversation message.",
    enabled: true,
    html: `
      <h1>New message from {{sender.name}}</h1>
      <p>{{message.preview}}</p>
      <p><a class="button" href="{{conversation.url}}">Reply on {{app.name}}</a></p>
      <p class="muted">You can update message email preferences from your notification settings.</p>
    `,
    key: "message.new",
    name: "New message",
    preheader: "{{sender.name}} sent you a message on {{app.name}}.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      conversation: {
        url: "https://homzie.co.za/messages?conversation=00000000-0000-0000-0000-000000000000",
      },
      message: { preview: "Hi, is this property still available?" },
      sender: { name: "Mia Patel", username: "miapatel" },
      user: { firstName: "Dillon", name: "Dillon Jurgens" },
    },
    subject: "New message from {{sender.name}}",
    text: "{{sender.name}} sent you a message: {{message.preview}} Reply: {{conversation.url}}",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "sender.name", label: "Sender name" },
      { key: "sender.username", label: "Sender username" },
      { key: "message.preview", label: "Message preview" },
      { key: "conversation.url", label: "Conversation URL" },
    ],
  },
  {
    category: "Reels",
    description: "Sent to followers when an agent they follow publishes a reel.",
    enabled: true,
    html: `
      <h1>{{agent.name}} posted a new property reel</h1>
      <p>{{reel.caption}}</p>
      <p><a class="button" href="{{reel.url}}">Watch reel</a></p>
      <p class="muted">You are receiving this because you follow {{agent.name}}.</p>
    `,
    key: "reel.new_from_followed_profile",
    name: "New reel from followed profile",
    preheader: "{{agent.name}} posted a new property reel.",
    sampleVariables: {
      agent: { name: "Ava Morgan", username: "avamorgan" },
      app: { name: "Homzie", url: "https://homzie.co.za" },
      reel: {
        caption: "A quick walk-through of a bright three-bedroom home.",
        url: "https://homzie.co.za/users/avamorgan/reels",
      },
      user: { firstName: "Sam", name: "Sam Buyer" },
    },
    subject: "New property reel from {{agent.name}}",
    text: "{{agent.name}} posted a new property reel on {{app.name}}. Watch it: {{reel.url}}",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "agent.name", label: "Agent name" },
      { key: "agent.username", label: "Agent username" },
      { key: "reel.caption", label: "Reel caption" },
      { key: "reel.url", label: "Reel URL" },
    ],
  },
  {
    category: "Billing",
    description: "Sent when an agent trial starts.",
    enabled: true,
    html: `
      <h1>Your agent trial has started</h1>
      <p>You can now publish listings, create property reels, and start building your Homzie profile.</p>
      <p>Your trial ends on <strong>{{subscription.trialEndsAt}}</strong>.</p>
      <p><a class="button" href="{{billingUrl}}">Manage billing</a></p>
    `,
    key: "billing.subscription_trial_started",
    name: "Agent trial started",
    preheader: "Your Homzie agent trial is active.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      billingUrl: "https://homzie.co.za/settings/billing",
      subscription: { trialEndsAt: "18 June 2026" },
      user: { firstName: "Dillon", name: "Dillon Jurgens" },
    },
    subject: "Your {{app.name}} agent trial has started",
    text: "Your {{app.name}} agent trial has started. Manage billing: {{billingUrl}}",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "subscription.trialEndsAt", label: "Trial end date" },
      { key: "billingUrl", label: "Billing URL" },
    ],
  },
  {
    category: "Billing",
    description: "Sent when an agent subscription becomes active.",
    enabled: true,
    html: `
      <h1>Your Homzie Agent subscription is active</h1>
      <p>Your profile can now publish listings, reels, and campaigns.</p>
      <p><strong>{{subscription.amount}}</strong> / {{subscription.interval}}</p>
      <p><a class="button" href="{{profileUrl}}">Open your profile</a></p>
    `,
    key: "billing.subscription_active",
    name: "Subscription active",
    preheader: "Your Homzie Agent subscription is active.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      profileUrl: "https://homzie.co.za/users/dillon",
      subscription: { amount: "R 349", interval: "month" },
      user: { firstName: "Dillon", name: "Dillon Jurgens" },
    },
    subject: "Your {{app.name}} Agent subscription is active",
    text: "Your {{app.name}} Agent subscription is active. Open your profile: {{profileUrl}}",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "subscription.amount", label: "Subscription amount" },
      { key: "subscription.interval", label: "Subscription interval" },
      { key: "profileUrl", label: "Profile URL" },
    ],
  },
  {
    category: "Billing",
    description: "Sent when a subscription invoice payment fails.",
    enabled: true,
    html: `
      <h1>Payment needs attention</h1>
      <p>We could not process your latest Homzie Agent payment.</p>
      <p>{{invoice.message}}</p>
      <p><a class="button" href="{{billingUrl}}">Update billing</a></p>
    `,
    key: "billing.payment_failed",
    name: "Payment failed",
    preheader: "Your Homzie payment needs attention.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      billingUrl: "https://homzie.co.za/settings/billing",
      invoice: { amount: "R 349", message: "Please update your payment method." },
      user: { firstName: "Dillon", name: "Dillon Jurgens" },
    },
    subject: "Your {{app.name}} payment needs attention",
    text: "Your {{app.name}} payment needs attention. {{invoice.message}} Update billing: {{billingUrl}}",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "invoice.amount", label: "Invoice amount" },
      { key: "invoice.message", label: "Failure message" },
      { key: "billingUrl", label: "Billing URL" },
    ],
  },
  {
    category: "Billing",
    description: "Sent when a subscription invoice is paid.",
    enabled: true,
    html: `
      <h1>Payment received</h1>
      <p>Thanks, {{user.firstName}}. We received your Homzie Agent payment of <strong>{{invoice.amount}}</strong>.</p>
      <p><a class="button" href="{{billingUrl}}">View billing</a></p>
    `,
    key: "billing.invoice_paid",
    name: "Invoice paid",
    preheader: "Your Homzie payment was received.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      billingUrl: "https://homzie.co.za/settings/billing",
      invoice: { amount: "R 349" },
      user: { firstName: "Dillon", name: "Dillon Jurgens" },
    },
    subject: "Payment received for {{app.name}}",
    text: "Payment received for {{app.name}}: {{invoice.amount}}. View billing: {{billingUrl}}",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "invoice.amount", label: "Invoice amount" },
      { key: "billingUrl", label: "Billing URL" },
    ],
  },
  {
    category: "Ads",
    description: "Sent when an ad campaign is published.",
    enabled: true,
    html: `
      <h1>Your campaign is live</h1>
      <p>{{campaign.name}} is now ready to deliver on {{campaign.channels}}.</p>
      <p>Budget: <strong>{{campaign.budget}}</strong></p>
      <p><a class="button" href="{{campaignsUrl}}">View campaigns</a></p>
    `,
    key: "ads.campaign_published",
    name: "Campaign published",
    preheader: "Your Homzie campaign is live.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      campaign: {
        budget: "R 1,000",
        channels: "Homzie and Google",
        name: "Listing promotion",
      },
      campaignsUrl: "https://homzie.co.za/settings/ads-center/campaigns",
      user: { firstName: "Dillon", name: "Dillon Jurgens" },
    },
    subject: "Your {{app.name}} campaign is live",
    text: "Your {{app.name}} campaign is live. View campaigns: {{campaignsUrl}}",
    variables: [
      ...commonVariables,
      { key: "campaign.name", label: "Campaign name" },
      { key: "campaign.channels", label: "Campaign channels" },
      { key: "campaign.budget", label: "Campaign budget" },
      { key: "campaignsUrl", label: "Campaigns URL" },
    ],
  },
  {
    category: "Ads",
    description: "Sent when campaign setup needs admin/user attention.",
    enabled: true,
    html: `
      <h1>Campaign needs attention</h1>
      <p>{{campaign.name}} was published, but {{campaign.issue}}</p>
      <p><a class="button" href="{{campaignsUrl}}">Review campaign</a></p>
    `,
    key: "ads.campaign_needs_attention",
    name: "Campaign needs attention",
    preheader: "A Homzie campaign needs attention.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      campaign: {
        issue: "Google feed sync needs attention.",
        name: "Listing promotion",
      },
      campaignsUrl: "https://homzie.co.za/settings/ads-center/campaigns",
      user: { firstName: "Dillon", name: "Dillon Jurgens" },
    },
    subject: "Campaign needs attention on {{app.name}}",
    text: "{{campaign.name}} needs attention: {{campaign.issue}} Review: {{campaignsUrl}}",
    variables: [
      ...commonVariables,
      { key: "campaign.name", label: "Campaign name" },
      { key: "campaign.issue", label: "Campaign issue" },
      { key: "campaignsUrl", label: "Campaigns URL" },
    ],
  },
  {
    category: "Support",
    description: "Sent to Homzie support when someone submits the contact form.",
    enabled: true,
    html: `
      <h1>New Homzie contact message</h1>
      <p><strong>Name:</strong> {{contact.name}}</p>
      <p><strong>Email:</strong> {{contact.email}}</p>
      <p><strong>Phone:</strong> {{contact.phone}}</p>
      <p><strong>Subject:</strong> {{contact.subject}}</p>
      <p style="white-space:pre-wrap">{{contact.message}}</p>
    `,
    key: "support.contact_received",
    name: "Support contact received",
    preheader: "{{contact.name}} sent a contact message.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      contact: {
        email: "agent@example.com",
        message: "I need help with my account.",
        name: "Dillon Jurgens",
        phone: "+27 82 000 0000",
        subject: "Account help",
      },
    },
    subject: "Homzie contact: {{contact.subject}}",
    text: "Name: {{contact.name}}\nEmail: {{contact.email}}\nPhone: {{contact.phone}}\nSubject: {{contact.subject}}\n\n{{contact.message}}",
    variables: [
      ...commonVariables,
      { key: "contact.name", label: "Contact name" },
      { key: "contact.email", label: "Contact email" },
      { key: "contact.phone", label: "Contact phone" },
      { key: "contact.subject", label: "Contact subject" },
      { key: "contact.message", label: "Contact message" },
    ],
  },
  {
    category: "Support",
    description: "Sent to a user after they submit the contact form.",
    enabled: true,
    html: `
      <h1>We received your message</h1>
      <p>Thanks, {{contact.name}}. The Homzie team received your message about <strong>{{contact.subject}}</strong>.</p>
      <p>We will get back to you as soon as we can.</p>
    `,
    key: "support.contact_confirmation",
    name: "Support contact confirmation",
    preheader: "The Homzie team received your message.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      contact: { name: "Dillon Jurgens", subject: "Account help" },
    },
    subject: "We received your Homzie message",
    text: "Thanks, {{contact.name}}. The Homzie team received your message about {{contact.subject}}.",
    variables: [
      ...commonVariables,
      { key: "contact.name", label: "Contact name" },
      { key: "contact.subject", label: "Contact subject" },
    ],
  },
  {
    category: "Security",
    description: "Sent when someone requests a password reset link.",
    enabled: true,
    html: `
      <h1>Reset your {{app.name}} password</h1>
      <p>Use this secure link to choose a new password. The link expires in {{reset.expiresIn}}.</p>
      <p><a class="button" href="{{reset.url}}">Reset password</a></p>
      <p class="muted">If you did not request this, you can ignore this email.</p>
    `,
    key: "security.password_reset_requested",
    name: "Password reset link",
    preheader: "Use this secure link to reset your Homzie password.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      reset: {
        expiresIn: "30 minutes",
        url: "https://homzie.co.za/reset-password?token=sample",
      },
      user: { firstName: "Dillon", name: "Dillon Jurgens" },
    },
    subject: "Reset your {{app.name}} password",
    text: "Reset your {{app.name}} password using this link: {{reset.url}}. It expires in {{reset.expiresIn}}.",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "user.name", label: "Recipient full name" },
      { key: "reset.url", label: "Password reset URL" },
      { key: "reset.expiresIn", label: "Reset link expiry" },
    ],
  },
  {
    category: "Security",
    description: "Sent after a user changes their password.",
    enabled: true,
    html: `
      <h1>Your password was changed</h1>
      <p>If this was you, no action is needed.</p>
      <p>If you did not change your password, contact Homzie support immediately.</p>
    `,
    key: "security.password_changed",
    name: "Password changed",
    preheader: "Your Homzie password was changed.",
    sampleVariables: {
      app: { name: "Homzie", url: "https://homzie.co.za" },
      user: { firstName: "Dillon", name: "Dillon Jurgens" },
    },
    subject: "Your {{app.name}} password was changed",
    text: "Your {{app.name}} password was changed. If this was not you, contact support immediately.",
    variables: [
      ...commonVariables,
      { key: "user.firstName", label: "Recipient first name" },
      { key: "user.name", label: "Recipient full name" },
    ],
  },
] satisfies DefaultEmailTemplate[];

export function getDefaultTemplate(key: string) {
  return defaultEmailTemplates.find((template) => template.key === key) || null;
}

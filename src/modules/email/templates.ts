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
        url: "https://homzie.co.za/listings/00000000-0000-0000-0000-000000000000",
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
] satisfies DefaultEmailTemplate[];

export function getDefaultTemplate(key: string) {
  return defaultEmailTemplates.find((template) => template.key === key) || null;
}

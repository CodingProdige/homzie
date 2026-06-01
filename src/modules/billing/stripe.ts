import Stripe from "stripe";

export type AgentPlanInterval = "month" | "year";

export const agentSubscriptionPlans: Record<
  AgentPlanInterval,
  {
    label: string;
    amountLabel: string;
    intervalLabel: string;
    amountCents: number;
    currency: string;
    priceEnvKey: "STRIPE_AGENT_MONTHLY_PRICE_ID" | "STRIPE_AGENT_YEARLY_PRICE_ID";
  }
> = {
  month: {
    label: "Monthly",
    amountLabel: "R99",
    intervalLabel: "/month",
    amountCents: 9900,
    currency: "ZAR",
    priceEnvKey: "STRIPE_AGENT_MONTHLY_PRICE_ID",
  },
  year: {
    label: "Yearly",
    amountLabel: "R999",
    intervalLabel: "/year",
    amountCents: 99900,
    currency: "ZAR",
    priceEnvKey: "STRIPE_AGENT_YEARLY_PRICE_ID",
  },
};

export const defaultAgentPlanInterval: AgentPlanInterval = "month";
export const agentSubscriptionPrice =
  agentSubscriptionPlans[defaultAgentPlanInterval];

const requiredStripeEnvKeys = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_AGENT_MONTHLY_PRICE_ID",
  "STRIPE_AGENT_YEARLY_PRICE_ID",
] as const;

export function getMissingStripeEnvKeys() {
  return requiredStripeEnvKeys.filter((key) => !process.env[key]);
}

export function getStripePriceId(interval: AgentPlanInterval) {
  return process.env[agentSubscriptionPlans[interval].priceEnvKey];
}

export function getInvalidStripePriceEnvKeys() {
  return requiredStripeEnvKeys
    .filter((key) => key.endsWith("_PRICE_ID"))
    .filter((key) => {
      const value = process.env[key];
      return value && !value.startsWith("price_");
    });
}

export function getStripePublishableKey() {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
}

let stripe: Stripe | null = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required.");
  }

  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export function isAgentPlanInterval(value: unknown): value is AgentPlanInterval {
  return value === "month" || value === "year";
}

export function toAppSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing") {
    return "active";
  }

  if (status === "past_due" || status === "unpaid") {
    return "past_due";
  }

  if (status === "canceled") {
    return "cancelled";
  }

  if (status === "incomplete_expired") {
    return "expired";
  }

  return "pending";
}

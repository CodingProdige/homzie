import Stripe from "stripe";

import {
  getStoredStripeSettings,
  getStripeSettingsWithEnvFallback,
} from "@/modules/platform-settings/stripe-settings";
import type { AgentPlanInterval } from "./plans";

const requiredStripeEnvKeys = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_AGENT_MONTHLY_PRICE_ID",
  "STRIPE_AGENT_YEARLY_PRICE_ID",
] as const;

type StripeRuntimeConfig = {
  mode: "test" | "live";
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
};

const stripeConfigKeys = {
  STRIPE_SECRET_KEY: "secretKey",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "publishableKey",
  STRIPE_AGENT_MONTHLY_PRICE_ID: "monthlyPriceId",
  STRIPE_AGENT_YEARLY_PRICE_ID: "yearlyPriceId",
} as const satisfies Record<
  (typeof requiredStripeEnvKeys)[number],
  keyof StripeRuntimeConfig
>;

export async function getStripeRuntimeConfig() {
  const settings = await getStoredStripeSettings();
  return getStripeSettingsWithEnvFallback(settings);
}

export async function getMissingStripeConfigKeys() {
  const config = await getStripeRuntimeConfig();

  return requiredStripeEnvKeys.filter((key) => !config[stripeConfigKeys[key]]);
}

export async function getStripePriceId(interval: AgentPlanInterval) {
  const config = await getStripeRuntimeConfig();

  return interval === "month" ? config.monthlyPriceId : config.yearlyPriceId;
}

export async function getInvalidStripePriceConfigKeys() {
  const config = await getStripeRuntimeConfig();

  return requiredStripeEnvKeys
    .filter((key) => key.endsWith("_PRICE_ID"))
    .filter((key) => {
      const value = config[stripeConfigKeys[key]];
      return value && !value.startsWith("price_");
    });
}

export async function getStripePublishableKey() {
  const config = await getStripeRuntimeConfig();

  return config.publishableKey;
}

let stripe: { client: Stripe; secretKey: string } | null = null;

export async function getStripe() {
  const config = await getStripeRuntimeConfig();

  if (!config.secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required.");
  }

  if (!stripe || stripe.secretKey !== config.secretKey) {
    stripe = {
      client: new Stripe(config.secretKey),
      secretKey: config.secretKey,
    };
  }

  return stripe.client;
}

export async function getStripeWebhookSecret() {
  const config = await getStripeRuntimeConfig();

  return config.webhookSecret;
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

import { eq } from "drizzle-orm";
import Stripe from "stripe";

import { db } from "@/db";
import { agentProfiles, subscriptions, users } from "@/db/schema";
import {
  absoluteAppUrl,
  notifyUser,
} from "@/modules/email/server";
import { toAppSubscriptionStatus } from "./stripe";

function toDate(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000) : null;
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const typedSubscription = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
    trial_end?: number | null;
  };

  return {
    currentPeriodStart: toDate(typedSubscription.current_period_start),
    currentPeriodEnd:
      toDate(typedSubscription.current_period_end) ||
      toDate(typedSubscription.trial_end),
  };
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "soon";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

async function getSubscriptionUser(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user || null;
}

export async function sendSubscriptionTrialStartedEmail({
  trialEndsAt,
  userId,
}: {
  trialEndsAt?: Date | null;
  userId: string;
}) {
  const user = await getSubscriptionUser(userId);

  if (!user) return;

  await notifyUser({
    bypassPreferences: true,
    eventKey: "billing.subscription_trial_started",
    templateKey: "billing.subscription_trial_started",
    userId,
    variables: {
      app: {
        name: "Homzie",
        url: absoluteAppUrl("/"),
      },
      billingUrl: absoluteAppUrl("/settings/billing"),
      subscription: {
        trialEndsAt: formatDate(trialEndsAt),
      },
      user: {
        firstName: user.name.split(/\s+/)[0] || user.name,
        name: user.name,
      },
    },
  });
}

async function sendSubscriptionActiveEmail({
  amountCents,
  currency,
  interval,
  userId,
}: {
  amountCents: number;
  currency: string;
  interval: string;
  userId: string;
}) {
  const user = await getSubscriptionUser(userId);

  if (!user) return;

  await notifyUser({
    bypassPreferences: true,
    eventKey: "billing.subscription_active",
    templateKey: "billing.subscription_active",
    userId,
    variables: {
      app: {
        name: "Homzie",
        url: absoluteAppUrl("/"),
      },
      profileUrl: absoluteAppUrl(user.username ? `/users/${user.username}` : "/settings/billing"),
      subscription: {
        amount: formatMoney(amountCents, currency),
        interval,
      },
      user: {
        firstName: user.name.split(/\s+/)[0] || user.name,
        name: user.name,
      },
    },
  });
}

export async function sendStripeInvoiceEmail({
  invoice,
  type,
}: {
  invoice: Stripe.Invoice;
  type: "paid" | "failed";
}) {
  const invoiceSubscription = (
    invoice as Stripe.Invoice & {
      subscription?: string | { id: string } | null;
    }
  ).subscription;
  const subscriptionId =
    typeof invoiceSubscription === "string"
      ? invoiceSubscription
      : invoiceSubscription?.id ?? null;

  if (!subscriptionId) return;

  const [subscription] = await db
    .select({
      userId: subscriptions.userId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.providerReference, subscriptionId))
    .limit(1);

  if (!subscription) return;

  const user = await getSubscriptionUser(subscription.userId);

  if (!user) return;

  const amountCents =
    type === "failed"
      ? invoice.amount_due || invoice.amount_remaining || invoice.amount_paid || 0
      : invoice.amount_paid || invoice.amount_due || 0;
  const currency = (invoice.currency || "zar").toUpperCase();

  await notifyUser({
    bypassPreferences: true,
    eventKey: type === "failed" ? "billing.payment_failed" : "billing.invoice_paid",
    templateKey: type === "failed" ? "billing.payment_failed" : "billing.invoice_paid",
    userId: subscription.userId,
    variables: {
      app: {
        name: "Homzie",
        url: absoluteAppUrl("/"),
      },
      billingUrl: absoluteAppUrl("/settings/billing"),
      invoice: {
        amount: formatMoney(amountCents, currency),
        message:
          type === "failed"
            ? "Please update your payment method to keep your agent tools active."
            : "Your subscription remains active.",
      },
      user: {
        firstName: user.name.split(/\s+/)[0] || user.name,
        name: user.name,
      },
    },
  });
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  const agentProfileId = subscription.metadata.agentProfileId || null;
  const interval = subscription.metadata.interval || "month";
  const status = toAppSubscriptionStatus(subscription.status);
  const { currentPeriodStart, currentPeriodEnd } =
    getSubscriptionPeriod(subscription);

  const firstItem = subscription.items.data[0];
  const amountCents = firstItem?.price.unit_amount || 0;
  const currency = (firstItem?.price.currency || "zar").toUpperCase();
  const customer =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  if (!userId) {
    return { status, currentPeriodEnd };
  }

  const [existing] = await db
    .select({ id: subscriptions.id, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.providerReference, subscription.id))
    .limit(1);

  if (existing) {
    await db
      .update(subscriptions)
      .set({
        status,
        amountCents,
        currency,
        interval,
        providerCustomerId: customer,
        currentPeriodStart,
        currentPeriodEnd,
        cancelledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      userId,
      agentProfileId,
      provider: "stripe",
      status,
      amountCents,
      currency,
      interval,
      providerCustomerId: customer,
      providerReference: subscription.id,
      currentPeriodStart,
      currentPeriodEnd,
      cancelledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
    });
  }

  if (agentProfileId) {
    await db
      .update(agentProfiles)
      .set({
        status: status === "active" ? "active" : "draft",
        updatedAt: new Date(),
      })
      .where(eq(agentProfiles.id, agentProfileId));
  }

  const typedSubscription = subscription as Stripe.Subscription & {
    trial_end?: number | null;
  };

  if (typedSubscription.trial_end) {
    await db
      .update(users)
      .set({
        agentTrialUsedAt: toDate(typedSubscription.trial_end) || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  if (status === "active" && existing?.status !== "active") {
    await sendSubscriptionActiveEmail({
      amountCents,
      currency,
      interval,
      userId,
    }).catch((error) => {
      console.error("[email] subscription active failed", error);
    });
  }

  return { status, currentPeriodEnd };
}

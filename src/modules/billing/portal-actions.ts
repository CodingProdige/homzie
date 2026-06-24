"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { getStripe } from "./stripe";

function getBaseUrl() {
  return process.env.AUTH_URL || process.env.APP_URL || "http://localhost:3000";
}

export async function openBillingPortal() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [subscription] = await db
    .select({
      customerId: subscriptions.providerCustomerId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!subscription?.customerId) {
    redirect("/become-agent");
  }

  const stripe = await getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.customerId,
    return_url: new URL("/settings/billing", getBaseUrl()).toString(),
  });

  redirect(portalSession.url);
}

export async function cancelAgentSubscription() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [subscription] = await db
    .select({
      id: subscriptions.id,
      stripeSubscriptionId: subscriptions.providerReference,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!subscription?.stripeSubscriptionId) {
    redirect("/become-agent");
  }

  const stripe = await getStripe();
  const updatedSubscription = (await stripe.subscriptions.update(
    subscription.stripeSubscriptionId,
    {
      cancel_at_period_end: true,
    },
  )) as Stripe.Subscription & {
    cancel_at?: number | null;
    current_period_end?: number | null;
  };
  const scheduledEnd =
    updatedSubscription.cancel_at ||
    updatedSubscription.current_period_end ||
    Math.floor(Date.now() / 1000);

  await db
    .update(subscriptions)
    .set({
      cancelledAt: new Date(scheduledEnd * 1000),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id));

  revalidatePath("/settings/billing");
  redirect("/settings/billing");
}

export async function reactivateAgentSubscription() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [subscription] = await db
    .select({
      id: subscriptions.id,
      stripeSubscriptionId: subscriptions.providerReference,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!subscription?.stripeSubscriptionId) {
    redirect("/become-agent");
  }

  const stripe = await getStripe();
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: false,
    cancel_at: null,
  });

  await db
    .update(subscriptions)
    .set({
      cancelledAt: null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id));

  revalidatePath("/settings/billing");
  redirect("/settings/billing");
}

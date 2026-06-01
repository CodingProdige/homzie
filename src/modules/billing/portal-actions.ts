"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";

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

  const portalSession = await getStripe().billingPortal.sessions.create({
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

  await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await db
    .update(subscriptions)
    .set({
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id));

  revalidatePath("/settings/billing");
  redirect("/settings/billing");
}

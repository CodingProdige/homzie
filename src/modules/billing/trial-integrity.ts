import { and, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";

import { db } from "@/db";
import { agentProfiles, subscriptions, users } from "@/db/schema";
import { absoluteAppUrl, notifyUser } from "@/modules/email/server";
import { getStripe } from "./stripe";
import { hasSubscriptionPaymentMethod } from "./subscription-sync";

type TrialAuditRow = {
  agentProfileId: string | null;
  id: string;
  providerReference: string;
  userEmail: string;
  userId: string;
  userName: string;
};

type TrialAuditResult = {
  cancelled: number;
  checked: number;
  emailed: number;
  errors: Array<{ email: string; message: string; subscriptionId: string }>;
  skipped: number;
};

function hasCustomerPaymentMethod(customer: Stripe.Customer | Stripe.DeletedCustomer) {
  if (customer.deleted) return false;

  return Boolean(
    customer.invoice_settings?.default_payment_method ||
      customer.default_source,
  );
}

async function sendIncompleteTrialEmail(row: TrialAuditRow) {
  await notifyUser({
    bypassPreferences: true,
    eventKey: "billing.subscription_trial_incomplete",
    templateKey: "billing.subscription_trial_incomplete",
    userId: row.userId,
    variables: {
      app: {
        name: "Homzie",
        url: absoluteAppUrl("/"),
      },
      billingUrl: absoluteAppUrl("/settings/billing"),
      user: {
        firstName: row.userName.split(/\s+/)[0] || row.userName,
        name: row.userName,
      },
    },
  });
}

export async function auditIncompleteTrialSubscriptions(): Promise<TrialAuditResult> {
  const stripe = await getStripe();
  const rows = await db
    .select({
      agentProfileId: subscriptions.agentProfileId,
      id: subscriptions.id,
      providerReference: subscriptions.providerReference,
      userEmail: users.email,
      userId: subscriptions.userId,
      userName: users.name,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(
      and(
        eq(subscriptions.provider, "stripe"),
        inArray(subscriptions.status, ["active", "pending"]),
      ),
    );
  const result: TrialAuditResult = {
    cancelled: 0,
    checked: rows.length,
    emailed: 0,
    errors: [],
    skipped: 0,
  };

  for (const row of rows) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        row.providerReference,
      );

      if (stripeSubscription.status !== "trialing") {
        result.skipped += 1;
        continue;
      }

      const customerId =
        typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : stripeSubscription.customer.id;
      const customer = await stripe.customers.retrieve(customerId);
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        limit: 1,
        type: "card",
      });
      const hasPaymentMethod =
        hasSubscriptionPaymentMethod(stripeSubscription) ||
        hasCustomerPaymentMethod(customer) ||
        paymentMethods.data.length > 0;

      if (hasPaymentMethod) {
        result.skipped += 1;
        continue;
      }

      await stripe.subscriptions.cancel(stripeSubscription.id);

      await db
        .update(subscriptions)
        .set({
          cancelledAt: new Date(),
          status: "expired",
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, row.id));

      if (row.agentProfileId) {
        await db
          .update(agentProfiles)
          .set({
            status: "draft",
            updatedAt: new Date(),
          })
          .where(eq(agentProfiles.id, row.agentProfileId));
      }

      await db
        .update(users)
        .set({
          agentTrialUsedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, row.userId));

      await sendIncompleteTrialEmail(row);

      result.cancelled += 1;
      result.emailed += 1;
    } catch (error) {
      result.errors.push({
        email: row.userEmail,
        message: error instanceof Error ? error.message : "Unknown audit failure.",
        subscriptionId: row.providerReference,
      });
    }
  }

  return result;
}

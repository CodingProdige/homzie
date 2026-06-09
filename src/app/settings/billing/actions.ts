"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { getStripe, getStripePublishableKey } from "@/modules/billing/stripe";

type BillingActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type RetentionOfferState = {
  status: "available" | "active" | "used" | "ineligible";
  expiresOn: string | null;
  message: string | null;
};

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
}

async function getCurrentUserSubscription() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Sign in again to manage billing.");
  }

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!subscription?.providerCustomerId || !subscription.providerReference) {
    throw new Error("No active billing account was found.");
  }

  return subscription;
}

async function getCustomerPaymentMethods(customerId: string) {
  const stripe = await getStripe();

  return (
    await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 20,
    })
  ).data;
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function localRetentionOfferState(
  subscription: Awaited<ReturnType<typeof getCurrentUserSubscription>>,
): RetentionOfferState {
  if (subscription.interval !== "month") {
    return {
      status: "ineligible",
      expiresOn: null,
      message: "This loyalty offer is only available on monthly plans.",
    };
  }

  if (subscription.retentionOfferAcceptedAt) {
    const isActive =
      subscription.retentionOfferExpiresAt &&
      subscription.retentionOfferExpiresAt > new Date();

    return {
      status: isActive ? "active" : "used",
      expiresOn: isActive ? formatDate(subscription.retentionOfferExpiresAt) : null,
      message: isActive
        ? "Your 50% loyalty discount is already active on this subscription."
        : "Your loyalty discount has already been used on this account.",
    };
  }

  return {
    status: "available",
    expiresOn: null,
    message: null,
  };
}

export async function getRetentionOfferState(): Promise<RetentionOfferState> {
  const subscription = await getCurrentUserSubscription();
  const localState = localRetentionOfferState(subscription);

  if (localState.status !== "available") {
    return localState;
  }

  try {
    const stripe = await getStripe();
    const stripeSubscription = (await stripe.subscriptions.retrieve(
      subscription.providerReference,
    )) as {
      discounts?: Array<unknown> | null;
    };

    if (Array.isArray(stripeSubscription.discounts) && stripeSubscription.discounts.length) {
      return {
        status: "active",
        expiresOn: formatDate(subscription.retentionOfferExpiresAt),
        message: "A loyalty discount is already active on this subscription.",
      };
    }
  } catch {
    return localState;
  }

  return localState;
}

export async function createPaymentMethodSetupIntent(): Promise<
  | {
      ok: true;
      clientSecret: string;
      publishableKey: string;
    }
  | { ok: false; error: string }
> {
  try {
    const subscription = await getCurrentUserSubscription();
    const stripe = await getStripe();
    const customerId = subscription.providerCustomerId;

    if (!customerId) {
      throw new Error("No active billing account was found.");
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        subscriptionId: subscription.id,
        stripeSubscriptionId: subscription.providerReference,
      },
    });

    if (!setupIntent.client_secret) {
      throw new Error("Could not start payment method setup.");
    }

    return {
      ok: true,
      clientSecret: setupIntent.client_secret,
      publishableKey: await getStripePublishableKey(),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not start payment method setup.",
    };
  }
}

export async function saveDefaultPaymentMethod(
  setupIntentId: string,
): Promise<BillingActionResult> {
  try {
    const subscription = await getCurrentUserSubscription();
    const stripe = await getStripe();
    const customerId = subscription.providerCustomerId;

    if (!customerId) {
      throw new Error("No active billing account was found.");
    }

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.customer !== customerId) {
      throw new Error("This payment method does not belong to your account.");
    }

    if (!setupIntent.payment_method || typeof setupIntent.payment_method !== "string") {
      throw new Error("Could not find the saved payment method.");
    }

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: setupIntent.payment_method,
      },
    });

    await stripe.subscriptions.update(subscription.providerReference, {
      default_payment_method: setupIntent.payment_method,
    });

    revalidatePath("/settings/billing");

    return { ok: true, message: "Payment method saved." };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not save payment method.",
    };
  }
}

export async function setDefaultPaymentMethod(
  paymentMethodId: string,
): Promise<BillingActionResult> {
  try {
    const subscription = await getCurrentUserSubscription();
    const stripe = await getStripe();
    const customerId = subscription.providerCustomerId;

    if (!customerId) {
      throw new Error("No active billing account was found.");
    }

    const paymentMethods = await getCustomerPaymentMethods(customerId);
    const paymentMethod = paymentMethods.find((item) => item.id === paymentMethodId);

    if (!paymentMethod) {
      throw new Error("This payment method does not belong to your account.");
    }

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    await stripe.subscriptions.update(subscription.providerReference, {
      default_payment_method: paymentMethodId,
    });

    revalidatePath("/settings/billing");

    return { ok: true, message: "Default payment method updated." };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not update the default payment method.",
    };
  }
}

export async function removePaymentMethod(
  paymentMethodId: string,
): Promise<BillingActionResult> {
  try {
    const subscription = await getCurrentUserSubscription();
    const stripe = await getStripe();
    const customerId = subscription.providerCustomerId;

    if (!customerId) {
      throw new Error("No active billing account was found.");
    }

    const paymentMethods = await getCustomerPaymentMethods(customerId);
    const paymentMethod = paymentMethods.find((item) => item.id === paymentMethodId);

    if (!paymentMethod) {
      throw new Error("This payment method does not belong to your account.");
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.providerReference,
      {
        expand: ["default_payment_method"],
      },
    );
    const currentDefaultId =
      stripeSubscription.default_payment_method &&
      typeof stripeSubscription.default_payment_method !== "string"
        ? stripeSubscription.default_payment_method.id
        : typeof stripeSubscription.default_payment_method === "string"
          ? stripeSubscription.default_payment_method
          : null;
    const isDefault = currentDefaultId === paymentMethodId;
    const alternativePaymentMethod = paymentMethods.find(
      (item) => item.id !== paymentMethodId,
    );

    if (
      isDefault &&
      !alternativePaymentMethod &&
      (subscription.status === "active" || subscription.status === "past_due")
    ) {
      throw new Error(
        "Add another payment method before removing the default card for an active subscription.",
      );
    }

    if (isDefault && alternativePaymentMethod) {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: alternativePaymentMethod.id,
        },
      });

      await stripe.subscriptions.update(subscription.providerReference, {
        default_payment_method: alternativePaymentMethod.id,
      });
    }

    await stripe.paymentMethods.detach(paymentMethodId);

    revalidatePath("/settings/billing");

    return { ok: true, message: "Payment method removed." };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not remove the payment method.",
    };
  }
}

export async function applyRetentionDiscount(): Promise<BillingActionResult> {
  try {
    const subscription = await getCurrentUserSubscription();
    const offerState = await getRetentionOfferState();

    if (offerState.status === "ineligible") {
      throw new Error("This loyalty offer is only available on monthly plans.");
    }

    if (offerState.status === "used") {
      throw new Error("This loyalty offer has already been used on your account.");
    }

    if (offerState.status === "active") {
      throw new Error("A loyalty discount is already active on this subscription.");
    }

    const stripe = await getStripe();
    const customerId = subscription.providerCustomerId;

    if (!customerId) {
      throw new Error("No active billing account was found.");
    }

    const coupon = await stripe.coupons.create({
      duration: "repeating",
      duration_in_months: 2,
      metadata: {
        reason: "subscription_retention",
        subscriptionId: subscription.id,
      },
      name: "Homzie loyalty discount",
      percent_off: 50,
    });

    await stripe.subscriptions.update(subscription.providerReference, {
      discounts: [{ coupon: coupon.id }],
    });

    const now = new Date();
    const offerExpiresAt = addMonths(subscription.currentPeriodEnd || now, 2);

    await db
      .update(subscriptions)
      .set({
        retentionOfferAcceptedAt: now,
        retentionOfferExpiresAt: offerExpiresAt,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, subscription.id));

    revalidatePath("/settings/billing");

    return { ok: true, message: "Your 50% discount has been applied for two months." };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not apply the discount.",
    };
  }
}

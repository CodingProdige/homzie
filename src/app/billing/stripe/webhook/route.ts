import Stripe from "stripe";

import { getStripe, getStripeWebhookSecret } from "@/modules/billing/stripe";
import {
  getInvoiceSubscriptionId,
  sendStripeInvoiceEmail,
  syncStripeSubscription,
} from "@/modules/billing/subscription-sync";
import {
  syncListingReservationCharge,
  syncListingReservationCheckoutSession,
  syncListingReservationCheckoutSessionFailure,
  syncListingReservationDispute,
  syncListingReservationPaymentIntent,
} from "@/modules/listings/reservations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = await getStripeWebhookSecret();

  if (!webhookSecret) {
    return Response.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const stripe = await getStripe();
  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await syncStripeSubscription(event.data.object as Stripe.Subscription);
  }

  if (
    event.type === "invoice.payment_succeeded" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = getInvoiceSubscriptionId(invoice);

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncStripeSubscription(subscription);
    }

    await sendStripeInvoiceEmail({
      invoice,
      type: event.type === "invoice.payment_failed" ? "failed" : "paid",
    });
  }

  if (event.type === "checkout.session.completed") {
    await syncListingReservationCheckoutSession(
      event.data.object as Stripe.Checkout.Session,
    );
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    await syncListingReservationCheckoutSession(
      event.data.object as Stripe.Checkout.Session,
    );
  }

  if (event.type === "checkout.session.async_payment_failed") {
    await syncListingReservationCheckoutSessionFailure(
      event.data.object as Stripe.Checkout.Session,
      "Stripe checkout asynchronous payment failed.",
    );
  }

  if (event.type === "checkout.session.expired") {
    await syncListingReservationCheckoutSessionFailure(
      event.data.object as Stripe.Checkout.Session,
      "Stripe checkout session expired before payment.",
    );
  }

  if (event.type === "payment_intent.succeeded") {
    await syncListingReservationPaymentIntent(
      event.data.object as Stripe.PaymentIntent,
      "succeeded",
    );
  }

  if (event.type === "payment_intent.payment_failed") {
    await syncListingReservationPaymentIntent(
      event.data.object as Stripe.PaymentIntent,
      "failed",
    );
  }

  if (event.type === "charge.succeeded") {
    await syncListingReservationCharge(event.data.object as Stripe.Charge, "succeeded");
  }

  if (event.type === "charge.refunded") {
    await syncListingReservationCharge(event.data.object as Stripe.Charge, "refunded");
  }

  if (event.type === "charge.dispute.created") {
    await syncListingReservationDispute(
      event.data.object as Stripe.Dispute,
      "created",
    );
  }

  if (event.type === "charge.dispute.updated") {
    await syncListingReservationDispute(
      event.data.object as Stripe.Dispute,
      "updated",
    );
  }

  if (event.type === "charge.dispute.closed") {
    await syncListingReservationDispute(
      event.data.object as Stripe.Dispute,
      "closed",
    );
  }

  return Response.json({ received: true });
}

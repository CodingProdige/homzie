import Stripe from "stripe";

import { getStripe, getStripeWebhookSecret } from "@/modules/billing/stripe";
import {
  sendStripeInvoiceEmail,
  syncStripeSubscription,
} from "@/modules/billing/subscription-sync";
import { syncListingReservationCheckoutSession } from "@/modules/listings/reservations";

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

  return Response.json({ received: true });
}

import Stripe from "stripe";

import { getStripe, getStripeWebhookSecret } from "@/modules/billing/stripe";
import { syncStripeSubscription } from "@/modules/billing/subscription-sync";

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

  return Response.json({ received: true });
}

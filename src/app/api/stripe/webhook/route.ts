import { headers } from "next/headers";
import { NextResponse } from "next/server";
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
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const webhookSecret = await getStripeWebhookSecret();

  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 500 });
  }

  const stripe = await getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(subscription);
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
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
        break;
      }
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await syncListingReservationCheckoutSession(checkoutSession);
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await syncListingReservationCheckoutSession(checkoutSession);
        break;
      }
      case "checkout.session.async_payment_failed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await syncListingReservationCheckoutSessionFailure(
          checkoutSession,
          "Stripe checkout asynchronous payment failed.",
        );
        break;
      }
      case "checkout.session.expired": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await syncListingReservationCheckoutSessionFailure(
          checkoutSession,
          "Stripe checkout session expired before payment.",
        );
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await syncListingReservationPaymentIntent(paymentIntent, "succeeded");
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await syncListingReservationPaymentIntent(paymentIntent, "failed");
        break;
      }
      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;
        await syncListingReservationCharge(charge, "succeeded");
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await syncListingReservationCharge(charge, "refunded");
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await syncListingReservationDispute(dispute, "created");
        break;
      }
      case "charge.dispute.updated": {
        const dispute = event.data.object as Stripe.Dispute;
        await syncListingReservationDispute(dispute, "updated");
        break;
      }
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        await syncListingReservationDispute(dispute, "closed");
        break;
      }
      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

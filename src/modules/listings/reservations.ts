import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  listingReservations,
  propertyListingStatusHistory,
  propertyListings,
  users,
} from "@/db/schema";
import { createUserEvent } from "@/modules/events/server";
import { absoluteAppUrl, notifyUser } from "@/modules/email/server";

function paymentIntentId(
  value: string | Stripe.PaymentIntent | null | undefined,
) {
  if (!value) return null;

  return typeof value === "string" ? value : value.id;
}

function formatMoney(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

export async function syncListingReservationCheckoutSession(
  session: Stripe.Checkout.Session,
) {
  if (session.metadata?.type !== "listing_reservation") return;

  const reservationId = session.metadata.reservationId;
  const listingId = session.metadata.listingId;

  if (!reservationId || !listingId || session.payment_status !== "paid") {
    return;
  }

  const [reservation] = await db
    .select({
      agentUserId: listingReservations.agentUserId,
      amountCents: listingReservations.amountCents,
      buyerUserId: listingReservations.buyerUserId,
      currency: listingReservations.currency,
      id: listingReservations.id,
      status: listingReservations.status,
      totalPaidCents: listingReservations.totalPaidCents,
    })
    .from(listingReservations)
    .where(eq(listingReservations.id, reservationId))
    .limit(1);

  if (!reservation || reservation.status === "paid") {
    return;
  }

  const [listing] = await db
    .select({
      location: propertyListings.location,
      status: propertyListings.status,
      title: propertyListings.title,
    })
    .from(propertyListings)
    .where(eq(propertyListings.id, listingId))
    .limit(1);

  if (!listing || listing.status !== "published") {
    await db
      .update(listingReservations)
      .set({
        cancelledReason: "Payment completed after listing became unavailable.",
        status: "needs_review",
        stripePaymentIntentId: paymentIntentId(session.payment_intent),
        updatedAt: new Date(),
      })
      .where(eq(listingReservations.id, reservationId));
    return;
  }

  const now = new Date();

  await db
    .update(listingReservations)
    .set({
      documentRequestSentAt: now,
      paidAt: now,
      status: "awaiting_documents",
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId(session.payment_intent),
      updatedAt: now,
    })
    .where(eq(listingReservations.id, reservationId));

  await db
    .update(propertyListings)
    .set({
      activeReservationId: reservationId,
      status: "reserved",
      updatedAt: now,
    })
    .where(
      and(eq(propertyListings.id, listingId), eq(propertyListings.status, "published")),
    );

  await db.insert(propertyListingStatusHistory).values({
    fromStatus: "published",
    listingId,
    reason: "Reservation payment completed.",
    toStatus: "reserved",
    userId: reservation.buyerUserId,
  });

  await createUserEvent({
    actorUserId: reservation.buyerUserId,
    entityId: reservation.id,
    entityType: "listing_reservation",
    eventType: "listing.reserved",
    listingId,
    metadata: {
      amountCents: reservation.amountCents,
      listingTitle: listing.title,
    },
    userId: reservation.agentUserId,
  });

  const [agent] = await db
    .select({
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, reservation.agentUserId))
    .limit(1);

  await notifyUser({
    eventKey: "listing.reservation_document_request",
    preferenceCategory: "listingActivity",
    templateKey: "listing.reservation_document_request",
    userId: reservation.agentUserId,
    variables: {
      agent: {
        name: agent?.name || "Agent",
        username: agent?.username || "",
      },
      app: {
        name: "Homzie",
        url: absoluteAppUrl("/"),
      },
      listing: {
        location: listing.location || "",
        title: listing.title,
        url: absoluteAppUrl(`/listings/${listingId}`),
      },
      reservation: {
        adminUrl: absoluteAppUrl(
          `/admin/reservations?reservation=${reservation.id}`,
        ),
        amount: formatMoney(reservation.amountCents, reservation.currency),
        totalPaid: formatMoney(
          reservation.totalPaidCents,
          reservation.currency,
        ),
      },
    },
  }).catch((error) => {
    console.error("[email] reservation document request failed", error);
  });
}

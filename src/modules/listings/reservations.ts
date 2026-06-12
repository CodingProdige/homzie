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
import { buildListingPath } from "@/modules/listings/seo";

function paymentIntentId(
  value: string | Stripe.PaymentIntent | null | undefined,
) {
  if (!value) return null;

  return typeof value === "string" ? value : value.id;
}

function chargeId(value: string | Stripe.Charge | null | undefined) {
  if (!value) return null;

  return typeof value === "string" ? value : value.id;
}

function metadataReservationId(metadata: Stripe.Metadata | null | undefined) {
  return metadata?.type === "listing_reservation" ? metadata.reservationId : null;
}

function metadataListingId(metadata: Stripe.Metadata | null | undefined) {
  return metadata?.type === "listing_reservation" ? metadata.listingId : null;
}

function reservationFailureReason(eventLabel: string) {
  return `Stripe ${eventLabel} event received.`;
}

function formatMoney(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    style: "currency",
  }).format(cents / 100);
}

async function reopenListingForReservation(reservationId: string, reason: string) {
  const [listing] = await db
    .select({
      id: propertyListings.id,
      status: propertyListings.status,
    })
    .from(propertyListings)
    .where(eq(propertyListings.activeReservationId, reservationId))
    .limit(1);

  if (!listing || listing.status !== "reserved") return;

  await db
    .update(propertyListings)
    .set({
      activeReservationId: null,
      status: "published",
      updatedAt: new Date(),
    })
    .where(eq(propertyListings.id, listing.id));

  await db.insert(propertyListingStatusHistory).values({
    fromStatus: "reserved",
    listingId: listing.id,
    reason,
    toStatus: "published",
  });
}

async function cancelPendingReservation({
  checkoutSessionId,
  listingId,
  paymentIntentId: stripePaymentIntentId,
  reason,
  reservationId,
}: {
  checkoutSessionId?: string | null;
  listingId?: string | null;
  paymentIntentId?: string | null;
  reason: string;
  reservationId?: string | null;
}) {
  if (!reservationId && !checkoutSessionId && !stripePaymentIntentId) return;

  const now = new Date();
  const rows = await db
    .select({
      id: listingReservations.id,
      status: listingReservations.status,
    })
    .from(listingReservations)
    .where(
      reservationId
        ? eq(listingReservations.id, reservationId)
        : checkoutSessionId
          ? eq(listingReservations.stripeCheckoutSessionId, checkoutSessionId)
          : eq(listingReservations.stripePaymentIntentId, stripePaymentIntentId || ""),
    )
    .limit(1);
  const reservation = rows[0];

  if (!reservation) return;

  if (reservation.status !== "pending") {
    return;
  }

  await db
    .update(listingReservations)
    .set({
      cancelledAt: now,
      cancelledReason: reason,
      releaseStatus: "cancelled",
      status: "cancelled",
      stripeCheckoutSessionId: checkoutSessionId || undefined,
      stripePaymentIntentId: stripePaymentIntentId || undefined,
      updatedAt: now,
    })
    .where(eq(listingReservations.id, reservation.id));

  if (listingId) {
    await db
      .update(propertyListings)
      .set({
        activeReservationId: null,
        status: "published",
        updatedAt: now,
      })
      .where(
        and(
          eq(propertyListings.id, listingId),
          eq(propertyListings.activeReservationId, reservation.id),
        ),
      );
  }
}

async function flagReservationForReview({
  chargeId: stripeChargeId,
  paymentIntentId: stripePaymentIntentId,
  reason,
  reservationId,
  status = "needs_review",
}: {
  chargeId?: string | null;
  paymentIntentId?: string | null;
  reason: string;
  reservationId: string;
  status?: "needs_review" | "refund_required";
}) {
  await db
    .update(listingReservations)
    .set({
      cancelledReason: reason,
      releaseStatus: status === "refund_required" ? "refund_required" : "held",
      status,
      stripeChargeId: stripeChargeId || undefined,
      stripePaymentIntentId: stripePaymentIntentId || undefined,
      updatedAt: new Date(),
    })
    .where(eq(listingReservations.id, reservationId));
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

  await completeListingReservationPayment({
    checkoutSessionId: session.id,
    listingId,
    paymentIntentId: paymentIntentId(session.payment_intent),
    reservationId,
  });
}

export async function completeListingReservationPayment({
  chargeId: stripeChargeId,
  checkoutSessionId,
  listingId,
  paymentIntentId: stripePaymentIntentId,
  reservationId,
}: {
  chargeId?: string | null;
  checkoutSessionId?: string | null;
  listingId: string;
  paymentIntentId?: string | null;
  reservationId: string;
}) {
  if (!reservationId || !listingId) return;

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

  if (!reservation || reservation.status !== "pending") {
    return;
  }

  const [listing] = await db
    .select({
      details: propertyListings.details,
      id: propertyListings.id,
      listingType: propertyListings.listingType,
      location: propertyListings.location,
      propertyType: propertyListings.propertyType,
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
        stripePaymentIntentId: stripePaymentIntentId || undefined,
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
      stripeChargeId: stripeChargeId || undefined,
      stripeCheckoutSessionId: checkoutSessionId || undefined,
      stripePaymentIntentId: stripePaymentIntentId || undefined,
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
  const listingDetails =
    listing.details && typeof listing.details === "object" && !Array.isArray(listing.details)
      ? (listing.details as Record<string, unknown>)
      : {};
  const listingUrl = absoluteAppUrl(
    buildListingPath({
      bedrooms: listingDetails.bedrooms as number | string | null,
      city: typeof listingDetails.city === "string" ? listingDetails.city : "",
      country: typeof listingDetails.country === "string" ? listingDetails.country : "",
      id: listing.id,
      listingType: listing.listingType,
      location: listing.location,
      propertyType: listing.propertyType,
      province:
        (typeof listingDetails.province === "string" ? listingDetails.province : "") ||
        (typeof listingDetails.state === "string" ? listingDetails.state : "") ||
        (typeof listingDetails.region === "string" ? listingDetails.region : ""),
      suburb: typeof listingDetails.suburb === "string" ? listingDetails.suburb : "",
      title: listing.title,
    }),
  );

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
        url: listingUrl,
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

export async function syncListingReservationCheckoutSessionFailure(
  session: Stripe.Checkout.Session,
  reason: string,
) {
  if (session.metadata?.type !== "listing_reservation") return;

  await cancelPendingReservation({
    checkoutSessionId: session.id,
    listingId: metadataListingId(session.metadata),
    paymentIntentId: paymentIntentId(session.payment_intent),
    reason,
    reservationId: metadataReservationId(session.metadata),
  });
}

export async function syncListingReservationPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
  eventType: "succeeded" | "failed",
) {
  const reservationId = metadataReservationId(paymentIntent.metadata);
  const listingId = metadataListingId(paymentIntent.metadata);

  if (!reservationId) return;

  const latestChargeId = chargeId(paymentIntent.latest_charge);

  if (eventType === "failed") {
    await cancelPendingReservation({
      paymentIntentId: paymentIntent.id,
      reason: reservationFailureReason("payment_intent.payment_failed"),
      reservationId,
    });
    return;
  }

  if (listingId) {
    await completeListingReservationPayment({
      chargeId: latestChargeId,
      listingId,
      paymentIntentId: paymentIntent.id,
      reservationId,
    });
    return;
  }

  await db
    .update(listingReservations)
    .set({
      stripeChargeId: latestChargeId || undefined,
      stripePaymentIntentId: paymentIntent.id,
      updatedAt: new Date(),
    })
    .where(eq(listingReservations.id, reservationId));
}

export async function syncListingReservationCharge(
  charge: Stripe.Charge,
  eventType: "succeeded" | "refunded",
) {
  const reservationId = metadataReservationId(charge.metadata);
  const stripePaymentIntentId = paymentIntentId(charge.payment_intent);

  const [reservation] = await db
    .select({
      id: listingReservations.id,
      listingId: listingReservations.listingId,
      status: listingReservations.status,
    })
    .from(listingReservations)
    .where(
      reservationId
        ? eq(listingReservations.id, reservationId)
        : eq(listingReservations.stripePaymentIntentId, stripePaymentIntentId || ""),
    )
    .limit(1);

  if (!reservation) return;

  if (eventType === "succeeded") {
    await db
      .update(listingReservations)
      .set({
        stripeChargeId: charge.id,
        stripePaymentIntentId: stripePaymentIntentId || undefined,
        updatedAt: new Date(),
      })
      .where(eq(listingReservations.id, reservation.id));
    return;
  }

  const now = new Date();

  await db
    .update(listingReservations)
    .set({
      cancelledReason: reservationFailureReason("charge.refunded"),
      refundedAt: now,
      releaseStatus: "refunded",
      status: "refunded",
      stripeChargeId: charge.id,
      stripePaymentIntentId: stripePaymentIntentId || undefined,
      updatedAt: now,
    })
    .where(eq(listingReservations.id, reservation.id));

  await reopenListingForReservation(
    reservation.id,
    "Reservation payment refunded by Stripe.",
  );
}

export async function syncListingReservationDispute(
  dispute: Stripe.Dispute,
  eventType: "created" | "updated" | "closed",
) {
  const stripeChargeId = chargeId(dispute.charge);
  const stripePaymentIntentId = paymentIntentId(dispute.payment_intent);

  if (!stripeChargeId && !stripePaymentIntentId) return;

  const [reservation] = await db
    .select({
      id: listingReservations.id,
    })
    .from(listingReservations)
    .where(
      stripeChargeId
        ? eq(listingReservations.stripeChargeId, stripeChargeId)
        : eq(listingReservations.stripePaymentIntentId, stripePaymentIntentId || ""),
    )
    .limit(1);

  if (!reservation) return;

  if (eventType === "closed" && dispute.status === "lost") {
    await flagReservationForReview({
      chargeId: stripeChargeId,
      paymentIntentId: stripePaymentIntentId,
      reason: "Stripe dispute closed as lost.",
      reservationId: reservation.id,
      status: "refund_required",
    });
    return;
  }

  if (eventType === "closed" && dispute.status === "won") {
    await flagReservationForReview({
      chargeId: stripeChargeId,
      paymentIntentId: stripePaymentIntentId,
      reason: "Stripe dispute closed as won. Review before releasing funds.",
      reservationId: reservation.id,
      status: "needs_review",
    });
    return;
  }

  await flagReservationForReview({
    chargeId: stripeChargeId,
    paymentIntentId: stripePaymentIntentId,
    reason: `Stripe dispute ${eventType}: ${dispute.status}.`,
    reservationId: reservation.id,
    status: "needs_review",
  });
}

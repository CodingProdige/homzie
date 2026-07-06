"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
import { getAgencyListingAccessForUser } from "@/modules/listings/agency-listing-access";

type AgencyListingRequestActionRow = {
  agency_id: string;
  listing_id: string;
  status: string;
};

type AgencyListingActionRow = {
  agency_id: string | null;
  status: string;
};

const agencyListingStatusLabels: Record<string, string> = {
  archived: "Archived",
  published: "Published",
  sold: "Sold",
  under_offer: "Under offer",
};

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function requireUuid(value: string, label: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error(`${label} is invalid.`);
  }

  return value;
}

async function requireAgencyListingReviewer(userId: string, agencyId: string) {
  const access = await getAgencyListingAccessForUser(userId);

  if (!access || access.agencyId !== agencyId || !access.canReviewListingRequests) {
    throw new Error("You do not have permission to review agency listings.");
  }

  return access;
}

async function requireAgencyListingManager(userId: string, agencyId: string) {
  const access = await getAgencyListingAccessForUser(userId);

  if (!access || access.agencyId !== agencyId || !access.canEditAgencyListings) {
    throw new Error("You do not have permission to manage agency listings.");
  }

  return access;
}

export async function approveAgencyListingRequest(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/controlroom/agency/listing-requests");
  }

  const requestId = requireUuid(formString(formData, "requestId"), "Request ID");
  const reviewNote = formString(formData, "reviewNote").slice(0, 500) || null;
  const [request] = await sql<AgencyListingRequestActionRow[]>`
    SELECT agency_id, listing_id, status
    FROM agency_listing_requests
    WHERE id = ${requestId}
    LIMIT 1
  `;

  if (!request) {
    throw new Error("Listing request not found.");
  }

  const access = await requireAgencyListingReviewer(
    session.user.id,
    request.agency_id,
  );

  await sql.begin(async (tx) => {
    const [listing] = await tx<AgencyListingActionRow[]>`
      SELECT agency_id, status
      FROM property_listings
      WHERE id = ${request.listing_id}
      LIMIT 1
    `;

    if (!listing || listing.agency_id !== access.agencyId) {
      throw new Error("Listing not found.");
    }

    await tx`
      UPDATE agency_listing_requests
      SET
        review_note = ${reviewNote},
        reviewed_at = now(),
        reviewed_by_user_id = ${session.user.id},
        status = 'approved',
        updated_at = now()
      WHERE id = ${requestId}
    `;

    await tx`
      UPDATE property_listings
      SET
        listed_at = CASE WHEN status = 'published' THEN listed_at ELSE now() END,
        status = 'published',
        updated_at = now()
      WHERE id = ${request.listing_id}
    `;

    await tx`
      INSERT INTO property_listing_status_history (
        listing_id,
        user_id,
        from_status,
        to_status,
        reason
      )
      VALUES (
        ${request.listing_id},
        ${session.user.id},
        ${listing.status},
        'published',
        'Agency approved listing request.'
      )
    `;
  });

  revalidatePath("/controlroom/agency/listing-requests");
  revalidatePath("/controlroom/agency/listings");
  redirect("/controlroom/agency/listing-requests?request=approved");
}

export async function rejectAgencyListingRequest(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/controlroom/agency/listing-requests");
  }

  const requestId = requireUuid(formString(formData, "requestId"), "Request ID");
  const reviewNote = formString(formData, "reviewNote").slice(0, 500) || null;
  const [request] = await sql<AgencyListingRequestActionRow[]>`
    SELECT agency_id, listing_id, status
    FROM agency_listing_requests
    WHERE id = ${requestId}
    LIMIT 1
  `;

  if (!request) {
    throw new Error("Listing request not found.");
  }

  const access = await requireAgencyListingReviewer(
    session.user.id,
    request.agency_id,
  );

  await sql.begin(async (tx) => {
    const [listing] = await tx<AgencyListingActionRow[]>`
      SELECT agency_id, status
      FROM property_listings
      WHERE id = ${request.listing_id}
      LIMIT 1
    `;

    if (!listing || listing.agency_id !== access.agencyId) {
      throw new Error("Listing not found.");
    }

    await tx`
      UPDATE agency_listing_requests
      SET
        review_note = ${reviewNote},
        reviewed_at = now(),
        reviewed_by_user_id = ${session.user.id},
        status = 'rejected',
        updated_at = now()
      WHERE id = ${requestId}
    `;

    await tx`
      UPDATE property_listings
      SET status = 'draft', updated_at = now()
      WHERE id = ${request.listing_id}
    `;

    await tx`
      INSERT INTO property_listing_status_history (
        listing_id,
        user_id,
        from_status,
        to_status,
        reason
      )
      VALUES (
        ${request.listing_id},
        ${session.user.id},
        ${listing.status},
        'draft',
        ${reviewNote || "Agency rejected listing request."}
      )
    `;
  });

  revalidatePath("/controlroom/agency/listing-requests");
  revalidatePath("/controlroom/agency/listings");
  redirect("/controlroom/agency/listing-requests?request=rejected");
}

export async function updateAgencyListingStatus(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/controlroom/agency/listings");
  }

  const listingId = requireUuid(formString(formData, "listingId"), "Listing ID");
  const nextStatus = formString(formData, "status");

  if (!Object.hasOwn(agencyListingStatusLabels, nextStatus)) {
    throw new Error("Listing status is invalid.");
  }

  const [listing] = await sql<AgencyListingActionRow[]>`
    SELECT agency_id, status
    FROM property_listings
    WHERE id = ${listingId}
    LIMIT 1
  `;

  if (!listing?.agency_id) {
    throw new Error("Listing not found.");
  }

  await requireAgencyListingManager(session.user.id, listing.agency_id);

  await sql.begin(async (tx) => {
    await tx`
      UPDATE property_listings
      SET
        archived_at = CASE WHEN ${nextStatus} = 'archived' THEN now() ELSE archived_at END,
        listed_at = CASE WHEN ${nextStatus} = 'published' THEN now() ELSE listed_at END,
        outcome_at = CASE
          WHEN ${nextStatus} IN ('sold', 'archived') THEN now()
          ELSE outcome_at
        END,
        sold_at = CASE WHEN ${nextStatus} = 'sold' THEN now() ELSE sold_at END,
        status = ${nextStatus},
        updated_at = now()
      WHERE id = ${listingId}
    `;

    await tx`
      INSERT INTO property_listing_status_history (
        listing_id,
        user_id,
        from_status,
        to_status,
        reason
      )
      VALUES (
        ${listingId},
        ${session.user.id},
        ${listing.status},
        ${nextStatus},
        ${`Agency changed listing status to ${agencyListingStatusLabels[nextStatus]}.`}
      )
    `;
  });

  revalidatePath("/controlroom/agency/listings");
  revalidatePath(`/listings/${listingId}`);
  redirect(`/controlroom/agency/listings?statusUpdated=${listingId}`);
}

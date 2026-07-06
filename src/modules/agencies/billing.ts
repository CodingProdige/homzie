import { sql as drizzleSql } from "drizzle-orm";

import { db, sql } from "@/db";
import { agencyBillingProfiles, agencySeatUsageEvents } from "@/db/schema";

export const agencySeatPriceKey = "agency_member_seat";
export const defaultAgencySeatUnitAmountCents = 9900;
export const defaultAgencyBillingCurrency = "ZAR";
export const agencyBillingCycleDays = 30;
const agencyBillingCycleMs = agencyBillingCycleDays * 24 * 60 * 60 * 1000;

type AgencySeatEventType = "seat_ended" | "seat_started";
type AgencyMemberStatus = "active" | "invited" | "removed" | "suspended";
type AgencyType = "branch" | "independent" | "network";

type SeatUsageWriter = {
  insert: typeof db.insert;
};

type AgencySeatPriceRow = {
  currency: string;
  id: string | null;
  unit_amount_cents: number | string;
};

type SqlDateValue = Date | number | string;

type AgencyBillingProfileRow = {
  billing_cycle_anchor_at?: SqlDateValue | null;
  billing_email: string | null;
  failure_message: string | null;
  payment_method_label: string | null;
  provider_customer_id: string | null;
  provider_payment_method_id: string | null;
  status: string;
};

type AgencyBillingInvoiceRow = {
  charged_at: SqlDateValue | null;
  credits_cents: number | string;
  currency: string;
  failure_message: string | null;
  id: string;
  invoice_due_at: SqlDateValue | null;
  invoice_issued_at: SqlDateValue | null;
  invoice_number: string;
  max_billable_seats: number | string;
  period_end: SqlDateValue;
  period_start: SqlDateValue;
  provider_charge_id: string | null;
  provider_payment_intent_id: string | null;
  status: string;
  subtotal_cents: number | string;
  total_cents: number | string;
  unit_amount_cents: number | string;
};

type AgencyBillingInvoiceDetailRow = AgencyBillingInvoiceRow & {
  agency_name: string;
  agency_type: AgencyType;
  billing_email: string | null;
  payment_method_label: string | null;
  region: string | null;
  slug: string;
};

function toDate(value: SqlDateValue) {
  return value instanceof Date ? value : new Date(value);
}

function nullableDate(value: SqlDateValue | null | undefined) {
  return value == null ? null : toDate(value);
}

function sqlDate(value: SqlDateValue) {
  return toDate(value).toISOString();
}

function isMissingColumnError(error: unknown, columnName: string) {
  return Boolean(
    typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "42703" &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.includes(columnName),
  );
}

export type AgencySeatBillingSnapshot = {
  billingCycleActive: boolean;
  billingCycleAnchorAt: Date | null;
  billingConfigured: boolean;
  billingEmail: string | null;
  currentSeats: number;
  currency: string;
  failureMessage: string | null;
  maxBillableSeats: number;
  paymentMethodLabel: string | null;
  periodEnd: Date;
  periodStart: Date;
  projectedTotalCents: number;
  seatPriceId: string | null;
  unitAmountCents: number;
};

export type AgencyBillingInvoice = {
  chargedAt: Date | null;
  creditsCents: number;
  currency: string;
  dueAt: Date | null;
  failureMessage: string | null;
  id: string;
  invoiceNumber: string;
  issuedAt: Date | null;
  maxBillableSeats: number;
  periodEnd: Date;
  periodStart: Date;
  providerChargeId: string | null;
  providerPaymentIntentId: string | null;
  status: string;
  subtotalCents: number;
  totalCents: number;
  unitAmountCents: number;
};

export type AgencyBillingInvoiceDetail = AgencyBillingInvoice & {
  agencyName: string;
  agencyType: AgencyType;
  billingEmail: string | null;
  paymentMethodLabel: string | null;
  region: string | null;
  slug: string;
};

export function isBillableAgencyMemberStatus(status: AgencyMemberStatus) {
  return status !== "removed";
}

export function agencyBillingPeriodFromAnchor(
  anchorAt: SqlDateValue,
  asOf = new Date(),
) {
  const anchorDate = toDate(anchorAt);
  const elapsedMs = Math.max(0, asOf.getTime() - anchorDate.getTime());
  const elapsedCycles = Math.floor(elapsedMs / agencyBillingCycleMs);
  const periodStart = new Date(
    anchorDate.getTime() + elapsedCycles * agencyBillingCycleMs,
  );
  const periodEnd = new Date(periodStart.getTime() + agencyBillingCycleMs);

  return { periodEnd, periodStart };
}

export function formatAgencyBillingMoney(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

export function formatAgencyBillingDate(value: SqlDateValue) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(toDate(value));
}

export function formatAgencyBillingPeriod(start: SqlDateValue, end: SqlDateValue) {
  const inclusiveEnd = new Date(toDate(end).getTime() - 1);

  return `${formatAgencyBillingDate(start)} - ${formatAgencyBillingDate(inclusiveEnd)}`;
}

function mapAgencyBillingInvoice(
  row: AgencyBillingInvoiceRow,
): AgencyBillingInvoice {
  return {
    chargedAt: nullableDate(row.charged_at),
    creditsCents: Number(row.credits_cents || 0),
    currency: row.currency,
    dueAt: nullableDate(row.invoice_due_at),
    failureMessage: row.failure_message,
    id: row.id,
    invoiceNumber: row.invoice_number,
    issuedAt: nullableDate(row.invoice_issued_at),
    maxBillableSeats: Number(row.max_billable_seats || 0),
    periodEnd: toDate(row.period_end),
    periodStart: toDate(row.period_start),
    providerChargeId: row.provider_charge_id,
    providerPaymentIntentId: row.provider_payment_intent_id,
    status: row.status,
    subtotalCents: Number(row.subtotal_cents || 0),
    totalCents: Number(row.total_cents || 0),
    unitAmountCents: Number(row.unit_amount_cents || 0),
  };
}

export async function getCurrentAgencySeatPrice(asOf = new Date()) {
  const asOfValue = sqlDate(asOf);
  const [price] = await sql<AgencySeatPriceRow[]>`
    SELECT
      id,
      unit_amount_cents,
      currency
    FROM agency_billing_prices
    WHERE price_key = ${agencySeatPriceKey}
      AND active_from <= ${asOfValue}
      AND (active_to IS NULL OR active_to > ${asOfValue})
    ORDER BY active_from DESC
    LIMIT 1
  `;

  return {
    currency: price?.currency || defaultAgencyBillingCurrency,
    id: price?.id || null,
    unitAmountCents:
      price?.unit_amount_cents === undefined
        ? defaultAgencySeatUnitAmountCents
        : Number(price.unit_amount_cents),
  };
}

export async function listAgencyBillingInvoices(agencyId: string, limit = 12) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await sql<AgencyBillingInvoiceRow[]>`
    SELECT
      id,
      invoice_number,
      invoice_issued_at,
      invoice_due_at,
      period_start,
      period_end,
      max_billable_seats,
      unit_amount_cents,
      subtotal_cents,
      credits_cents,
      total_cents,
      currency,
      status,
      provider_payment_intent_id,
      provider_charge_id,
      failure_message,
      charged_at
    FROM agency_billing_periods
    WHERE agency_id = ${agencyId}
      AND invoice_number IS NOT NULL
      AND status IN ('finalized', 'paid', 'past_due')
    ORDER BY period_start DESC
    LIMIT ${safeLimit}
  `;

  return rows.map(mapAgencyBillingInvoice);
}

export async function getAgencyBillingInvoiceDetail({
  agencyId,
  invoiceId,
}: {
  agencyId: string;
  invoiceId: string;
}): Promise<AgencyBillingInvoiceDetail | null> {
  const [row] = await sql<AgencyBillingInvoiceDetailRow[]>`
    SELECT
      p.id,
      p.invoice_number,
      p.invoice_issued_at,
      p.invoice_due_at,
      p.period_start,
      p.period_end,
      p.max_billable_seats,
      p.unit_amount_cents,
      p.subtotal_cents,
      p.credits_cents,
      p.total_cents,
      p.currency,
      p.status,
      p.provider_payment_intent_id,
      p.provider_charge_id,
      p.failure_message,
      p.charged_at,
      a.name AS agency_name,
      a.agency_type,
      a.region,
      a.slug,
      bp.billing_email,
      bp.payment_method_label
    FROM agency_billing_periods p
    INNER JOIN agencies a ON a.id = p.agency_id
    LEFT JOIN agency_billing_profiles bp ON bp.agency_id = p.agency_id
    WHERE p.agency_id = ${agencyId}
      AND p.id = ${invoiceId}
      AND p.invoice_number IS NOT NULL
    LIMIT 1
  `;

  if (!row) return null;

  return {
    ...mapAgencyBillingInvoice(row),
    agencyName: row.agency_name,
    agencyType: row.agency_type,
    billingEmail: row.billing_email,
    paymentMethodLabel: row.payment_method_label,
    region: row.region,
    slug: row.slug,
  };
}

export async function getAgencyBillingProfile(agencyId: string) {
  const [profile] = await sql<AgencyBillingProfileRow[]>`
    SELECT
      billing_email,
      failure_message,
      payment_method_label,
      provider_customer_id,
      provider_payment_method_id,
      status
    FROM agency_billing_profiles
    WHERE agency_id = ${agencyId}
    LIMIT 1
  `;

  return profile || null;
}

async function getAgencyBillingCycleAnchorFromActiveSeats(agencyId: string) {
  const [row] = await sql<Array<{ anchor_at: SqlDateValue | null }>>`
    SELECT min(e.occurred_at) AS anchor_at
    FROM agency_seat_usage_events e
    INNER JOIN agency_members am ON am.id = e.member_id
    WHERE e.agency_id = ${agencyId}
      AND e.event_type = 'seat_started'
      AND am.status <> 'removed'
  `;

  return nullableDate(row?.anchor_at);
}

export async function getAgencyBillingCycleAnchor(agencyId: string) {
  try {
    const [row] = await sql<Array<{ anchor_at: SqlDateValue | null }>>`
      SELECT
        coalesce(
          bp.billing_cycle_anchor_at,
          (
            SELECT min(e.occurred_at)
            FROM agency_seat_usage_events e
            WHERE e.agency_id = ${agencyId}
              AND e.event_type = 'seat_started'
              AND EXISTS (
                SELECT 1
                FROM agency_members am
                WHERE am.agency_id = ${agencyId}
                  AND am.status <> 'removed'
              )
          )
        ) AS anchor_at
      FROM agencies a
      LEFT JOIN agency_billing_profiles bp ON bp.agency_id = a.id
      WHERE a.id = ${agencyId}
      LIMIT 1
    `;

    return nullableDate(row?.anchor_at);
  } catch (error) {
    if (isMissingColumnError(error, "billing_cycle_anchor_at")) {
      return getAgencyBillingCycleAnchorFromActiveSeats(agencyId);
    }

    throw error;
  }
}

export async function getCurrentAgencyBillingPeriod(
  agencyId: string,
  asOf = new Date(),
) {
  const anchorAt = await getAgencyBillingCycleAnchor(agencyId);

  if (!anchorAt) return null;

  return {
    anchorAt,
    ...agencyBillingPeriodFromAnchor(anchorAt, asOf),
  };
}

export function agencyBillingProfileIsReady(
  profile: AgencyBillingProfileRow | null | undefined,
) {
  return Boolean(
    profile &&
      profile.status === "ready" &&
      profile.provider_customer_id &&
      profile.provider_payment_method_id,
  );
}

export async function hasAgencyBillingReady(agencyId: string) {
  return agencyBillingProfileIsReady(await getAgencyBillingProfile(agencyId));
}

export async function assertAgencyBillingReady(agencyId: string) {
  if (await hasAgencyBillingReady(agencyId)) return;

  throw new Error(
    "Add agency billing information before inviting or accepting agency-funded agents.",
  );
}

export async function recordAgencySeatUsageEvent(
  writer: SeatUsageWriter,
  {
    agencyId,
    eventType,
    memberId,
    occurredAt = new Date(),
  }: {
    agencyId: string;
    eventType: AgencySeatEventType;
    memberId: string;
    occurredAt?: Date;
  },
) {
  await writer.insert(agencySeatUsageEvents).values({
    agencyId,
    eventType,
    memberId,
    occurredAt,
  });

  if (eventType === "seat_started") {
    try {
      await writer
        .insert(agencyBillingProfiles)
        .values({
          agencyId,
          billingCycleAnchorAt: occurredAt,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          set: {
            billingCycleAnchorAt: drizzleSql`coalesce(${agencyBillingProfiles.billingCycleAnchorAt}, ${occurredAt})`,
            updatedAt: new Date(),
          },
          target: agencyBillingProfiles.agencyId,
        });
    } catch (error) {
      if (!isMissingColumnError(error, "billing_cycle_anchor_at")) {
        throw error;
      }
    }
  }
}

export async function setAgencySeatPrice({
  activeFrom = new Date(),
  adminUserId,
  currency = defaultAgencyBillingCurrency,
  unitAmountCents,
}: {
  activeFrom?: Date;
  adminUserId: string;
  currency?: string;
  unitAmountCents: number;
}) {
  const activeFromValue = sqlDate(activeFrom);

  await sql.begin(async (tx) => {
    await tx`
      UPDATE agency_billing_prices
      SET active_to = ${activeFromValue}
      WHERE price_key = ${agencySeatPriceKey}
        AND active_from < ${activeFromValue}
        AND (active_to IS NULL OR active_to > ${activeFromValue})
    `;

    await tx`
      INSERT INTO agency_billing_prices (
        price_key,
        unit_amount_cents,
        currency,
        active_from,
        created_by_admin_id
      )
      VALUES (
        ${agencySeatPriceKey},
        ${unitAmountCents},
        ${currency},
        ${activeFromValue},
        ${adminUserId}
      )
    `;
  });
}

export async function getAgencySeatBillingSnapshot(
  agencyId: string,
  asOf = new Date(),
): Promise<AgencySeatBillingSnapshot> {
  const [price, profile, currentSeats, billingPeriod] = await Promise.all([
    getCurrentAgencySeatPrice(asOf),
    getAgencyBillingProfile(agencyId),
    getAgencyCurrentBillableSeats(agencyId),
    getCurrentAgencyBillingPeriod(agencyId, asOf),
  ]);
  const periodStart = billingPeriod?.periodStart || asOf;
  const periodEnd =
    billingPeriod?.periodEnd || new Date(asOf.getTime() + agencyBillingCycleMs);
  const peakSeats = billingPeriod
    ? await getAgencyPeakBillableSeatsForPeriod(agencyId, periodStart, periodEnd)
    : 0;
  const maxBillableSeats = Math.max(currentSeats, peakSeats);

  return {
    billingCycleActive: Boolean(billingPeriod),
    billingCycleAnchorAt: billingPeriod?.anchorAt || null,
    billingConfigured: agencyBillingProfileIsReady(profile),
    billingEmail: profile?.billing_email || null,
    currentSeats,
    currency: price.currency,
    failureMessage: profile?.failure_message || null,
    maxBillableSeats,
    paymentMethodLabel: profile?.payment_method_label || null,
    periodEnd,
    periodStart,
    projectedTotalCents: maxBillableSeats * price.unitAmountCents,
    seatPriceId: price.id,
    unitAmountCents: price.unitAmountCents,
  };
}

export async function getAgencyCurrentBillableSeats(agencyId: string) {
  const [row] = await sql<Array<{ current_seats: number | string }>>`
    SELECT count(*)::int AS current_seats
    FROM agency_members
    WHERE agency_id = ${agencyId}
      AND status <> 'removed'
  `;

  return Number(row?.current_seats || 0);
}

export async function getAgencyPeakBillableSeatsForPeriod(
  agencyId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const periodStartValue = sqlDate(periodStart);
  const periodEndValue = sqlDate(periodEnd);
  const [row] = await sql<Array<{ max_billable_seats: number | string }>>`
    WITH ledger AS (
      SELECT
        occurred_at,
        CASE
          WHEN event_type = 'seat_started' THEN 1
          WHEN event_type = 'seat_ended' THEN -1
          ELSE 0
        END AS delta
      FROM agency_seat_usage_events
      WHERE agency_id = ${agencyId}
        AND occurred_at < ${periodEndValue}
    ),
    initial AS (
      SELECT coalesce(sum(delta), 0)::int AS seats
      FROM ledger
      WHERE occurred_at < ${periodStartValue}
    ),
    period_deltas AS (
      SELECT occurred_at, sum(delta)::int AS delta
      FROM ledger
      WHERE occurred_at >= ${periodStartValue}
        AND occurred_at < ${periodEndValue}
      GROUP BY occurred_at
    ),
    running AS (
      SELECT greatest(
        0,
        (SELECT seats FROM initial)
          + sum(delta) OVER (ORDER BY occurred_at ROWS UNBOUNDED PRECEDING)
      )::int AS seats
      FROM period_deltas
    )
    SELECT greatest(
      0,
      (SELECT seats FROM initial),
      coalesce((SELECT max(seats) FROM running), (SELECT seats FROM initial))
    )::int AS max_billable_seats
  `;

  return Number(row?.max_billable_seats || 0);
}

export async function getAdminAgencyBillingOverview() {
  const [price, totals] = await Promise.all([
    getCurrentAgencySeatPrice(),
    sql<
      Array<{
        agency_count: number | string;
        billable_seats: number | string;
        billing_ready_count: number | string;
      }>
    >`
      SELECT
        count(DISTINCT a.id)::int AS agency_count,
        count(am.id) FILTER (WHERE am.status <> 'removed')::int AS billable_seats,
        count(DISTINCT a.id) FILTER (
          WHERE bp.status = 'ready'
            AND bp.provider_customer_id IS NOT NULL
            AND bp.provider_payment_method_id IS NOT NULL
        )::int AS billing_ready_count
      FROM agencies a
      LEFT JOIN agency_members am ON am.agency_id = a.id
      LEFT JOIN agency_billing_profiles bp ON bp.agency_id = a.id
      WHERE a.status <> 'suspended'
    `,
  ]);
  const row = totals[0];

  return {
    agencyCount: Number(row?.agency_count || 0),
    billableSeats: Number(row?.billable_seats || 0),
    billingReadyCount: Number(row?.billing_ready_count || 0),
    currency: price.currency,
    projectedMonthlyCents: Number(row?.billable_seats || 0) * price.unitAmountCents,
    unitAmountCents: price.unitAmountCents,
  };
}

import { sql } from "@/db";
import { getStripe } from "@/modules/billing/stripe";
import {
  agencyBillingCycleDays,
  agencyBillingPeriodFromAnchor,
  getAgencyCurrentBillableSeats,
  getAgencyPeakBillableSeatsForPeriod,
  getCurrentAgencySeatPrice,
} from "./billing";

type BillableAgencyRow = {
  agency_id: string;
  billing_cycle_anchor_at: Date;
  provider_customer_id: string;
  provider_payment_method_id: string;
};

type ExistingPeriodRow = {
  id: string;
  invoice_number: string | null;
  status: string;
};

function sqlDate(value: Date) {
  return value.toISOString();
}

const maxAgencyBillingCatchUpCycles = 240;
const agencyBillingCycleMs = agencyBillingCycleDays * 24 * 60 * 60 * 1000;

export type AgencyBillingRunResult = {
  agencyId: string;
  amountCents: number;
  error?: string;
  periodEnd?: string;
  periodId?: string;
  periodStart?: string;
  status: "failed" | "paid" | "skipped";
};

export function closedAgencyBillingPeriodsFromAnchor(
  anchorAt: Date,
  asOf = new Date(),
) {
  const periods: Array<{ periodEnd: Date; periodStart: Date }> = [];
  let { periodEnd, periodStart } = agencyBillingPeriodFromAnchor(anchorAt, anchorAt);

  while (
    periodEnd.getTime() <= asOf.getTime() &&
    periods.length < maxAgencyBillingCatchUpCycles
  ) {
    periods.push({ periodEnd, periodStart });
    periodStart = periodEnd;
    periodEnd = new Date(periodStart.getTime() + agencyBillingCycleMs);
  }

  return periods;
}

async function getBillableAgencies() {
  return sql<BillableAgencyRow[]>`
    SELECT
      a.id AS agency_id,
      bp.billing_cycle_anchor_at,
      bp.provider_customer_id,
      bp.provider_payment_method_id
    FROM agencies a
    INNER JOIN agency_billing_profiles bp ON bp.agency_id = a.id
    WHERE a.status <> 'suspended'
      AND a.agency_type <> 'network'
      AND bp.status IN ('ready', 'past_due')
      AND bp.billing_cycle_anchor_at IS NOT NULL
      AND bp.provider_customer_id IS NOT NULL
      AND bp.provider_payment_method_id IS NOT NULL
    ORDER BY a.created_at ASC
  `;
}

async function getExistingBillingPeriod(
  agencyId: string,
  periodStart: Date,
) {
  const periodStartValue = sqlDate(periodStart);
  const [period] = await sql<ExistingPeriodRow[]>`
    SELECT id, invoice_number, status
    FROM agency_billing_periods
    WHERE agency_id = ${agencyId}
      AND period_start = ${periodStartValue}
    LIMIT 1
  `;

  return period || null;
}

async function nextAgencyInvoiceNumber() {
  const [row] = await sql<Array<{ invoice_number: string }>>`
    SELECT 'HAI-' || nextval('agency_invoice_number_seq')::text AS invoice_number
  `;

  return row.invoice_number;
}

async function upsertBillingPeriod({
  agencyId,
  creditsCents = 0,
  currency,
  maxBillableSeats,
  periodEnd,
  periodStart,
  priceId,
  reservedInvoiceNumber,
  status,
  totalCents,
  unitAmountCents,
}: {
  agencyId: string;
  creditsCents?: number;
  currency: string;
  maxBillableSeats: number;
  periodEnd: Date;
  periodStart: Date;
  priceId: string | null;
  reservedInvoiceNumber?: string | null;
  status: string;
  totalCents: number;
  unitAmountCents: number;
}) {
  const subtotalCents = maxBillableSeats * unitAmountCents;
  const invoiceNumber = reservedInvoiceNumber || (await nextAgencyInvoiceNumber());
  const periodStartValue = sqlDate(periodStart);
  const periodEndValue = sqlDate(periodEnd);
  const [period] = await sql<Array<{ id: string; invoice_number: string | null }>>`
    INSERT INTO agency_billing_periods (
      agency_id,
      price_id,
      period_start,
      period_end,
      max_billable_seats,
      unit_amount_cents,
      subtotal_cents,
      credits_cents,
      total_cents,
      currency,
      status,
      invoice_number,
      invoice_issued_at,
      invoice_due_at,
      finalized_at,
      updated_at
    )
    VALUES (
      ${agencyId},
      ${priceId},
      ${periodStartValue},
      ${periodEndValue},
      ${maxBillableSeats},
      ${unitAmountCents},
      ${subtotalCents},
      ${creditsCents},
      ${totalCents},
      ${currency},
      ${status},
      ${invoiceNumber},
      now(),
      now(),
      now(),
      now()
    )
    ON CONFLICT (agency_id, period_start) DO UPDATE SET
      price_id = excluded.price_id,
      period_end = excluded.period_end,
      max_billable_seats = excluded.max_billable_seats,
      unit_amount_cents = excluded.unit_amount_cents,
      subtotal_cents = excluded.subtotal_cents,
      credits_cents = excluded.credits_cents,
      total_cents = excluded.total_cents,
      currency = excluded.currency,
      status = excluded.status,
      invoice_number = coalesce(agency_billing_periods.invoice_number, excluded.invoice_number),
      invoice_issued_at = coalesce(agency_billing_periods.invoice_issued_at, excluded.invoice_issued_at),
      invoice_due_at = coalesce(agency_billing_periods.invoice_due_at, excluded.invoice_due_at),
      finalized_at = coalesce(agency_billing_periods.finalized_at, now()),
      failure_message = null,
      updated_at = now()
    RETURNING id, invoice_number
  `;

  return {
    id: period.id,
    invoiceNumber: period.invoice_number || invoiceNumber,
  };
}

async function clearBillingCycleAnchorIfNoSeats(agencyId: string) {
  const currentSeats = await getAgencyCurrentBillableSeats(agencyId);

  if (currentSeats > 0) return false;

  await sql`
    UPDATE agency_billing_profiles
    SET
      billing_cycle_anchor_at = null,
      updated_at = now()
    WHERE agency_id = ${agencyId}
  `;

  return true;
}

export async function finalizeDueAgencyBillingPeriods(asOf = new Date()) {
  const agencies = await getBillableAgencies();
  const stripe = await getStripe();
  const results: AgencyBillingRunResult[] = [];

  for (const agency of agencies) {
    const duePeriods = closedAgencyBillingPeriodsFromAnchor(
      agency.billing_cycle_anchor_at,
      asOf,
    );

    if (!duePeriods.length) {
      continue;
    }

    for (const { periodEnd, periodStart } of duePeriods) {
      const existingPeriod = await getExistingBillingPeriod(
        agency.agency_id,
        periodStart,
      );

      if (existingPeriod?.status === "paid") {
        results.push({
          agencyId: agency.agency_id,
          amountCents: 0,
          periodEnd: periodEnd.toISOString(),
          periodId: existingPeriod.id,
          periodStart: periodStart.toISOString(),
          status: "skipped",
        });

        if (await clearBillingCycleAnchorIfNoSeats(agency.agency_id)) break;
        continue;
      }

      const maxBillableSeats = await getAgencyPeakBillableSeatsForPeriod(
        agency.agency_id,
        periodStart,
        periodEnd,
      );

      if (maxBillableSeats <= 0) {
        results.push({
          agencyId: agency.agency_id,
          amountCents: 0,
          periodEnd: periodEnd.toISOString(),
          periodStart: periodStart.toISOString(),
          status: "skipped",
        });

        if (await clearBillingCycleAnchorIfNoSeats(agency.agency_id)) break;
        continue;
      }

      const price = await getCurrentAgencySeatPrice(
        new Date(periodEnd.getTime() - 1),
      );
      const totalCents = maxBillableSeats * price.unitAmountCents;
      const period = await upsertBillingPeriod({
        agencyId: agency.agency_id,
        currency: price.currency,
        maxBillableSeats,
        periodEnd,
        periodStart,
        priceId: price.id,
        reservedInvoiceNumber: existingPeriod?.invoice_number || null,
        status: "finalized",
        totalCents,
        unitAmountCents: price.unitAmountCents,
      });
      const periodId = period.id;

      try {
        const intent = await stripe.paymentIntents.create({
          amount: totalCents,
          confirm: true,
          currency: price.currency.toLowerCase(),
          customer: agency.provider_customer_id,
          description: `Homzie agency member seats - ${period.invoiceNumber}`,
          metadata: {
            agencyBillingPeriodId: periodId,
            agencyId: agency.agency_id,
            agencyInvoiceNumber: period.invoiceNumber,
            periodEnd: periodEnd.toISOString(),
            periodStart: periodStart.toISOString(),
          },
          off_session: true,
          payment_method: agency.provider_payment_method_id,
        });
        const chargeId =
          typeof intent.latest_charge === "string"
            ? intent.latest_charge
            : intent.latest_charge?.id || null;

        await sql`
          UPDATE agency_billing_periods
          SET
            charged_at = now(),
            failure_message = null,
            provider_charge_id = ${chargeId},
            provider_payment_intent_id = ${intent.id},
            status = 'paid',
            updated_at = now()
          WHERE id = ${periodId}
        `;

        await sql`
          UPDATE agency_billing_profiles
          SET
            failure_message = null,
            status = 'ready',
            updated_at = now()
          WHERE agency_id = ${agency.agency_id}
        `;

        results.push({
          agencyId: agency.agency_id,
          amountCents: totalCents,
          periodEnd: periodEnd.toISOString(),
          periodId,
          periodStart: periodStart.toISOString(),
          status: "paid",
        });

        if (await clearBillingCycleAnchorIfNoSeats(agency.agency_id)) break;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Agency billing charge failed.";

        await sql`
          UPDATE agency_billing_periods
          SET
            failure_message = ${message},
            status = 'past_due',
            updated_at = now()
          WHERE id = ${periodId}
        `;

        await sql`
          UPDATE agency_billing_profiles
          SET
            failure_message = ${message},
            status = 'past_due',
            updated_at = now()
          WHERE agency_id = ${agency.agency_id}
        `;

        results.push({
          agencyId: agency.agency_id,
          amountCents: totalCents,
          error: message,
          periodEnd: periodEnd.toISOString(),
          periodId,
          periodStart: periodStart.toISOString(),
          status: "failed",
        });
      }
    }
  }

  return {
    asOf,
    results,
  };
}

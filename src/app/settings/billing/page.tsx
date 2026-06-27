import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";
import {
  CalendarDays,
  CreditCard,
  HelpCircle,
  LockKeyhole,
  TrendingUp,
} from "lucide-react";
import type Stripe from "stripe";

import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import {
  getUserAdBillingSummary,
  listUserAdInvoices,
} from "@/modules/ads/billing";
import { authOptions } from "@/modules/auth/config";
import {
  agentSubscriptionPrice,
  agentSubscriptionTrialLabel,
  getAgentSubscriptionOfferLabel,
} from "@/modules/billing/plans";
import { getStripe, getStripeRuntimeConfig } from "@/modules/billing/stripe";
import { syncStripeSubscription } from "@/modules/billing/subscription-sync";
import { CurrencyAmount } from "@/modules/currency/currency-amount";
import { SettingsPageHeader } from "../settings-page-header";
import {
  AddPaymentMethodButton,
  CancelSubscriptionButton,
  InvoiceHistoryTable,
  PaymentMethodList,
  ReactivateSubscriptionButton,
} from "./billing-client-controls";

type BillingInvoice = {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: string;
  downloadUrl: string | null;
};

type BillingCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
} | null;

type BillingPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

type BillingData = {
  issue: BillingIssue | null;
  status: string;
  planName: string;
  cycle: string;
  price: string;
  nextCharge: string;
  nextChargeLabel: string;
  nextBillingDate: string;
  cancellationEndsOn: string | null;
  startedOn: string;
  card: BillingCard;
  paymentMethods: BillingPaymentMethod[];
  invoices: BillingInvoice[];
  stripeAvailable: boolean;
  trialDaysRemaining: number | null;
  trialEndsOn: string | null;
  retentionOffer: {
    status: "available" | "active" | "used" | "ineligible";
    expiresOn: string | null;
    message: string | null;
  };
};

type BillingIssue = {
  message: string;
  title: string;
};

type AdsBillingSummary = Awaited<ReturnType<typeof getUserAdBillingSummary>>;

function formatDate(value: Date | number | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = typeof value === "number" ? new Date(value * 1000) : value;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMoney(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatShortDate(value: Date | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function getTrialDaysRemaining(trialEndUnix: number | null | undefined) {
  if (!trialEndUnix) {
    return null;
  }

  const diffMs = trialEndUnix * 1000 - Date.now();

  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getSubscriptionPeriod(subscription: Stripe.Subscription | null) {
  const typedSubscription = subscription as
    | (Stripe.Subscription & {
        current_period_start?: number;
        current_period_end?: number;
      })
    | null;
  const firstItem = subscription?.items.data[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number;
        current_period_end?: number;
      })
    | undefined;

  return {
    start: typedSubscription?.current_period_start || firstItem?.current_period_start,
    end: typedSubscription?.current_period_end || firstItem?.current_period_end,
  };
}

function getStripeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Stripe billing data is unavailable right now.";
}

function getBillingIssue(error: unknown, mode: "test" | "live"): BillingIssue {
  const message = getStripeErrorMessage(error);
  const oppositeMode = mode === "test" ? "live" : "test";

  if (message.includes("similar object exists in live mode")) {
    return {
      title: "Billing is in sandbox mode",
      message:
        "Your plan is active, but live payment method details are hidden while sandbox billing is enabled.",
    };
  }

  if (message.includes("similar object exists in test mode")) {
    return {
      title: "Billing is in live mode",
      message:
        "Your sandbox subscription details are hidden while live billing is enabled.",
    };
  }

  if (message.includes("No such subscription") || message.includes("No such customer")) {
    return {
      title: "Payment details are unavailable",
      message: `Your plan is active, but payment method details are not available in ${mode} mode. They may belong to ${oppositeMode} billing.`,
    };
  }

  return {
    title: "Payment details are unavailable",
    message: "Your plan is active, but payment method details could not be loaded right now.",
  };
}

function getLocalBillingData(
  localSubscription: typeof subscriptions.$inferSelect,
  issue: BillingIssue,
): BillingData {
  const recurringInterval = localSubscription.interval;

  return {
    issue,
    status: localSubscription.cancelledAt ? "cancelling" : localSubscription.status,
    planName: "Homzie Agent Pro",
    cycle: recurringInterval === "year" ? "Yearly" : "Monthly",
    price: `${formatMoney(
      localSubscription.amountCents,
      localSubscription.currency,
    )} / ${recurringInterval === "year" ? "year" : "month"}`,
    nextCharge: localSubscription.cancelledAt
      ? "No further charges"
      : `${formatMoney(
          localSubscription.amountCents,
          localSubscription.currency,
        )} / ${recurringInterval === "year" ? "year" : "month"}`,
    nextChargeLabel: localSubscription.cancelledAt ? "Billing status" : "Next charge",
    nextBillingDate: formatDate(localSubscription.currentPeriodEnd),
    cancellationEndsOn: localSubscription.cancelledAt
      ? formatDate(localSubscription.cancelledAt)
      : null,
    startedOn: formatDate(localSubscription.currentPeriodStart || localSubscription.createdAt),
    card: null,
    paymentMethods: [],
    invoices: [],
    stripeAvailable: false,
    trialDaysRemaining: null,
    trialEndsOn: null,
    retentionOffer: {
      status:
        recurringInterval === "month"
          ? localSubscription.retentionOfferAcceptedAt
            ? localSubscription.retentionOfferExpiresAt &&
              localSubscription.retentionOfferExpiresAt > new Date()
              ? "active"
              : "used"
            : "available"
          : "ineligible",
      message: localSubscription.retentionOfferAcceptedAt
        ? localSubscription.retentionOfferExpiresAt &&
          localSubscription.retentionOfferExpiresAt > new Date()
          ? "Your 50% loyalty discount is active for your next charges."
          : "Your loyalty discount has already been used on this account."
        : recurringInterval === "month"
          ? null
          : "This loyalty offer is only available on monthly plans.",
      expiresOn:
        localSubscription.retentionOfferExpiresAt &&
        localSubscription.retentionOfferExpiresAt > new Date()
          ? formatDate(localSubscription.retentionOfferExpiresAt)
          : null,
    },
  };
}

async function getBillingData(userId: string): Promise<BillingData | null> {
  const [localSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!localSubscription?.providerReference || !localSubscription.providerCustomerId) {
    return null;
  }

  const stripeConfig = await getStripeRuntimeConfig();
  const stripe = await getStripe();
  let stripeSubscription: Stripe.Subscription;
  let syncedSubscription: Awaited<ReturnType<typeof syncStripeSubscription>> | null = null;

  try {
    stripeSubscription = await stripe.subscriptions.retrieve(
      localSubscription.providerReference,
      {
        expand: ["default_payment_method"],
      },
    );
    syncedSubscription = await syncStripeSubscription(stripeSubscription);
  } catch (error) {
    return getLocalBillingData(
      localSubscription,
      getBillingIssue(error, stripeConfig.mode),
    );
  }

  const period = getSubscriptionPeriod(stripeSubscription);
  const firstItem = stripeSubscription.items.data[0];
  const recurringInterval = firstItem?.price.recurring?.interval || localSubscription.interval;
  const amountCents = firstItem?.price.unit_amount || localSubscription.amountCents;
  const currency = (firstItem?.price.currency || localSubscription.currency).toUpperCase();
  const typedSubscription = stripeSubscription as Stripe.Subscription & {
    cancel_at?: number | null;
    cancel_at_period_end?: boolean;
    trial_end?: number | null;
  };
  const cancellationEndsOn =
    typedSubscription.cancel_at || localSubscription.cancelledAt
      ? formatDate(typedSubscription.cancel_at || localSubscription.cancelledAt)
      : null;
  const isCancellationScheduled =
    Boolean(typedSubscription.cancel_at_period_end || cancellationEndsOn);
  const isStripeTrialing = stripeSubscription.status === "trialing";
  const trialDaysRemaining = isStripeTrialing
    ? getTrialDaysRemaining(typedSubscription.trial_end)
    : null;
  const trialEndsOn = isStripeTrialing && typedSubscription.trial_end
    ? formatDate(typedSubscription.trial_end)
    : null;
  const isTrialing =
    isStripeTrialing &&
    trialDaysRemaining !== null &&
    trialDaysRemaining >= 0;
  const defaultPaymentMethod = stripeSubscription.default_payment_method;
  const defaultPaymentMethodId =
    defaultPaymentMethod && typeof defaultPaymentMethod !== "string"
      ? defaultPaymentMethod.id
      : typeof defaultPaymentMethod === "string"
        ? defaultPaymentMethod
        : null;
  let card: BillingCard = null;
  let paymentMethods: BillingPaymentMethod[] = [];

  if (
    defaultPaymentMethod &&
    typeof defaultPaymentMethod !== "string" &&
    defaultPaymentMethod.card
  ) {
    card = {
      id: defaultPaymentMethod.id,
      brand: defaultPaymentMethod.card.brand,
      last4: defaultPaymentMethod.card.last4,
      expMonth: defaultPaymentMethod.card.exp_month,
      expYear: defaultPaymentMethod.card.exp_year,
      isDefault: true,
    };
  }

  try {
    const stripePaymentMethods = await stripe.paymentMethods.list({
      customer: localSubscription.providerCustomerId,
      type: "card",
      limit: 20,
    });

    paymentMethods = stripePaymentMethods.data
      .filter((paymentMethod) => Boolean(paymentMethod.card))
      .map((paymentMethod) => ({
        id: paymentMethod.id,
        brand: paymentMethod.card?.brand || "card",
        last4: paymentMethod.card?.last4 || "----",
        expMonth: paymentMethod.card?.exp_month || 0,
        expYear: paymentMethod.card?.exp_year || 0,
        isDefault: paymentMethod.id === defaultPaymentMethodId,
      }));

    if (!card && paymentMethods[0]) {
      card =
        paymentMethods.find((paymentMethod) => paymentMethod.isDefault) ||
        paymentMethods[0];
    }
  } catch {
    paymentMethods = card ? [card] : [];
  }

  let invoices: Stripe.ApiList<Stripe.Invoice>["data"] = [];
  const standardCharge = `${formatMoney(amountCents, currency)} / ${
    recurringInterval === "year" ? "year" : "month"
  }`;
  let nextCharge = standardCharge;
  let nextChargeLabel = isTrialing ? "First charge after trial" : "Next charge";

  try {
    const seenInvoiceIds = new Set<string>();
    invoices = (
      await stripe.invoices.list({
        customer: localSubscription.providerCustomerId,
        limit: 20,
      })
    ).data.filter((invoice) => {
      if (seenInvoiceIds.has(invoice.id)) return false;
      seenInvoiceIds.add(invoice.id);

      if (invoice.status === "paid" && (invoice.amount_paid || invoice.total || 0) <= 0) {
        return false;
      }

      return true;
    }).slice(0, 5);
  } catch {
    invoices = [];
  }

  try {
    const upcomingInvoice = await stripe.invoices.createPreview({
      customer: localSubscription.providerCustomerId,
      subscription: stripeSubscription.id,
    });

    nextCharge = `${formatMoney(
      upcomingInvoice.amount_due ?? upcomingInvoice.total ?? amountCents,
      (upcomingInvoice.currency || currency).toUpperCase(),
    )} / ${recurringInterval === "year" ? "year" : "month"}`;
  } catch {
    nextCharge = standardCharge;
  }

  const retentionOffer =
    recurringInterval !== "month"
      ? {
          status: "ineligible" as const,
          expiresOn: null,
          message: "This loyalty offer is only available on monthly plans.",
        }
      : localSubscription.retentionOfferAcceptedAt
        ? localSubscription.retentionOfferExpiresAt &&
          localSubscription.retentionOfferExpiresAt > new Date()
          ? {
              status: "active" as const,
              expiresOn: formatDate(localSubscription.retentionOfferExpiresAt),
              message: "Your 50% loyalty discount is active for your next charges.",
            }
          : {
              status: "used" as const,
              expiresOn: null,
              message: "Your loyalty discount has already been used on this account.",
            }
        : {
            status: "available" as const,
            expiresOn: null,
            message: null,
          };

  if (retentionOffer.status === "active" && nextCharge !== standardCharge) {
    nextChargeLabel = "Discounted next charge";
  }

  return {
    issue: null,
    status: isCancellationScheduled
      ? "cancelling"
      : isTrialing
        ? "trialing"
        : syncedSubscription?.status || localSubscription.status,
    planName: "Homzie Agent Pro",
    cycle: recurringInterval === "year" ? "Yearly" : "Monthly",
    price: `${formatMoney(amountCents, currency)} / ${
      recurringInterval === "year" ? "year" : "month"
    }`,
    nextCharge: isCancellationScheduled ? "No further charges" : nextCharge,
    nextChargeLabel: isCancellationScheduled ? "Billing status" : nextChargeLabel,
    nextBillingDate: isCancellationScheduled && cancellationEndsOn
      ? cancellationEndsOn
      : isTrialing
      ? trialEndsOn || "Not available"
      : formatDate(
          period.end ||
            syncedSubscription?.currentPeriodEnd ||
            localSubscription.currentPeriodEnd,
        ),
    startedOn: formatDate(period.start || localSubscription.currentPeriodStart),
    cancellationEndsOn,
    card,
    paymentMethods,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      date: formatDate(invoice.created),
      description: invoice.description || "Homzie Agent Pro",
      amount: formatMoney(invoice.amount_paid || invoice.total || 0, invoice.currency),
      status: invoice.status || "open",
      downloadUrl: invoice.invoice_pdf || invoice.hosted_invoice_url || null,
    })),
    stripeAvailable: true,
    trialDaysRemaining,
    trialEndsOn,
    retentionOffer,
  };
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold capitalize text-primary">
      {status}
    </span>
  );
}

function BillingIssueNotice({ issue }: { issue: BillingIssue }) {
  return (
    <section className="rounded-lg border border-destructive/25 bg-destructive/10 p-5 text-destructive shadow-sm">
      <h2 className="text-base font-bold">{issue.title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6">{issue.message}</p>
    </section>
  );
}

function CurrentPlanCard({ billing }: { billing: BillingData | null }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.75fr)]">
        <div>
          <p className="text-sm font-bold text-primary">Current plan</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {billing?.planName || "No active agent plan"}
            </h2>
            {billing ? <StatusBadge status={billing.status} /> : null}
          </div>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Everything you need to build your property brand, publish listings,
            post reels and capture leads.
          </p>
        </div>

        <div className="grid gap-4 border-border lg:border-l lg:pl-8">
          <div className="flex gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-primary">
                {billing?.cancellationEndsOn ? "Access ends" : "Next billing date"}
              </p>
              <p className="mt-1 text-xl font-bold">
                {billing?.nextBillingDate || "Not available"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {billing?.cancellationEndsOn
                  ? `Your subscription is scheduled to end on ${billing.cancellationEndsOn}.`
                  : billing?.trialEndsOn
                  ? `Your ${agentSubscriptionTrialLabel.toLowerCase()} ends on ${billing.trialEndsOn}.`
                  : billing
                    ? `You will be charged ${billing.nextCharge}.`
                    : "Subscribe to activate billing."}
              </p>
              {billing?.trialEndsOn && billing.trialDaysRemaining !== null ? (
                <p className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {billing.cancellationEndsOn
                    ? billing.trialDaysRemaining === 0
                      ? "Access ends today"
                      : `${billing.trialDaysRemaining} day${billing.trialDaysRemaining === 1 ? "" : "s"} access remaining`
                    : billing.trialDaysRemaining === 0
                      ? "Trial ends today"
                      : `${billing.trialDaysRemaining} day${billing.trialDaysRemaining === 1 ? "" : "s"} remaining`}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-4 rounded-lg bg-secondary p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {billing?.nextChargeLabel || "Amount"}
              </p>
              <p className="text-xl font-bold">
                {billing?.nextCharge || (
                  <>
                    <CurrencyAmount cents={agentSubscriptionPrice.amountCents} /> / month
                  </>
                )}
              </p>
              {billing && billing.nextCharge !== billing.price ? (
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                  Standard plan price: {billing.price}
                </p>
              ) : null}
              {billing?.retentionOffer.status === "active" &&
              billing.retentionOffer.expiresOn ? (
                <p className="mt-1 text-xs font-semibold text-primary">
                  Discount active until {billing.retentionOffer.expiresOn}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PaymentMethodCard({ billing }: { billing: BillingData | null }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-bold">Payment method</h2>
        <AddPaymentMethodButton
          disabled={!billing?.stripeAvailable}
          label={billing?.paymentMethods.length ? "Add or replace" : "Add method"}
        />
      </div>

      <div className="mt-6">
        {billing?.paymentMethods.length ? (
          <PaymentMethodList
            hasProtectedSubscription={
              billing.status === "active" ||
              billing.status === "trialing" ||
              billing.status === "past_due"
            }
            methods={billing.paymentMethods}
          />
        ) : billing && !billing.stripeAvailable ? (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">
              Payment method details are unavailable while billing is in sandbox mode.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-sm text-muted-foreground">
              No saved payment method yet. Add one after subscribing.
            </p>
          </div>
        )}
      </div>

      <p className="mt-6 flex gap-2 text-sm text-muted-foreground">
        <LockKeyhole className="mt-0.5 size-4 shrink-0" />
        Your payment information is stored securely by Stripe.
      </p>
      {billing?.paymentMethods.length ? (
        <p className="mt-3 text-xs font-normal text-muted-foreground">
          To update a card, add a replacement, make it default, then remove the old one.
        </p>
      ) : null}
    </section>
  );
}

function InvoiceHistory({ invoices }: { invoices: BillingInvoice[] }) {
  const visibleInvoices = invoices.length
    ? invoices
    : [
        {
          id: "empty",
          date: "No invoices yet",
          description: "Invoices will appear after your first successful payment.",
          amount: "-",
          status: "pending",
          downloadUrl: null,
        },
      ];

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Invoice history</h2>
      </div>
      <InvoiceHistoryTable invoices={visibleInvoices} />
    </section>
  );
}

function AdsBillingOverview({
  summary,
}: {
  summary: AdsBillingSummary;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-bold">Ads billing</h2>
          <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
            Delivered ad spend rolls into monthly ads invoices on your billing cycle.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background px-4 py-3 text-right text-sm font-semibold">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Next ads billing date
          </p>
          <p className="mt-1 font-semibold text-foreground">
            {formatShortDate(summary.nextBillingDate)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Delivered spend
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatMoney(summary.deliveredSpendCents)}
          </p>
          <p className="mt-2 text-sm font-normal text-muted-foreground">
            Measured campaign spend accrued to date.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Awaiting invoice
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatMoney(summary.uninvoicedSpendCents)}
          </p>
          <p className="mt-2 text-sm font-normal text-muted-foreground">
            Delivered spend not yet invoiced.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Open invoices
          </p>
          <p className="mt-2 text-2xl font-semibold">{summary.openInvoiceCount}</p>
          <p className="mt-2 text-sm font-normal text-muted-foreground">
            {formatMoney(summary.openInvoiceTotalCents)} currently due or queued.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Paid to date
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatMoney(summary.paidInvoiceTotalCents)}
          </p>
          <p className="mt-2 text-sm font-normal text-muted-foreground">
            Across {summary.activeCampaignCount + summary.pausedCampaignCount} tracked campaigns.
          </p>
        </div>
      </div>
    </section>
  );
}

function AdsInvoiceHistory({
  invoices,
}: {
  invoices: BillingInvoice[];
}) {
  const visibleInvoices = invoices.length
    ? invoices
    : [
        {
          id: "empty-ads",
          date: "No ad invoices yet",
          description: "Ad invoices will appear once a billing period closes with delivered spend.",
          amount: "-",
          status: "pending",
          downloadUrl: null,
        },
      ];

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Ads invoice history</h2>
      </div>
      <InvoiceHistoryTable invoices={visibleInvoices} />
    </section>
  );
}

function SubscriptionDetails({ billing }: { billing: BillingData | null }) {
  const rows = [
    { label: "Plan", value: billing?.planName || "No active plan" },
    { label: "Billing cycle", value: billing?.cycle || "Monthly" },
    {
      label: "Price",
      value: billing?.price || (
        <>
          <CurrencyAmount cents={agentSubscriptionPrice.amountCents} /> / month
        </>
      ),
    },
    {
      label: billing?.nextChargeLabel || "Next charge",
      value: billing?.nextCharge || "Not available",
    },
    {
      label: billing?.cancellationEndsOn ? "Access ends" : "Next billing date",
      value: billing?.nextBillingDate || "Not available",
    },
    {
      label: "Payment method",
      value: billing?.card
        ? `•••• ${billing.card.last4}`
        : billing && !billing.stripeAvailable
          ? "Unavailable in sandbox"
          : "Not added",
    },
    { label: "Started on", value: billing?.startedOn || "Not available" },
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="font-bold">Subscription details</h2>
      <div className="mt-7 space-y-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
            <span>{row.label}</span>
            <span className="text-right font-medium text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
      {billing ? (
        <div className="mt-8 space-y-3">
          {billing.cancellationEndsOn ? (
            <ReactivateSubscriptionButton disabled={!billing.stripeAvailable} />
          ) : null}
          <CancelSubscriptionButton
            disabled={!billing.stripeAvailable || Boolean(billing.cancellationEndsOn)}
            retentionOffer={billing.retentionOffer}
          />
          {billing.cancellationEndsOn ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              This subscription is already scheduled to end on {billing.cancellationEndsOn}.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CompactAgentUpgradeCta({ trialEligible }: { trialEligible: boolean }) {
  return (
    <section className="overflow-hidden rounded-lg border border-primary/15 bg-brand-black p-5 text-white shadow-sm sm:p-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
            Buyer intent locked
          </p>
          <h2 className="mt-2 max-w-xl text-2xl font-bold leading-tight tracking-tight">
            Go Pro to unlock realtime buyer demand.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
            {trialEligible
              ? `Start with a ${agentSubscriptionTrialLabel.toLowerCase()} to see active buyers, buyer timelines, AI insights, and chat opportunities.`
              : "Subscribe to see active buyers, buyer timelines, AI insights, and chat opportunities."}
          </p>
        </div>
        <Button asChild className="h-11 px-6">
          <Link href="/become-agent">
            <TrendingUp className="size-4" />
            {trialEligible
              ? `Start ${getAgentSubscriptionOfferLabel(true)}`
              : "Subscribe now"}
          </Link>
        </Button>
      </div>
    </section>
  );
}

export default async function BillingSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({
      agentTrialUsedAt: users.agentTrialUsedAt,
      id: users.id,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const [previousSubscription] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  const billing = await getBillingData(user.id);
  const [adsBillingSummary, adInvoices] = await Promise.all([
    getUserAdBillingSummary(user.id),
    listUserAdInvoices(user.id, 8),
  ]);
  const adsInvoiceRows: BillingInvoice[] = adInvoices.map((invoice) => ({
    amount: formatMoney(invoice.totalCents),
    date: formatShortDate(invoice.createdAt),
    description: `${formatShortDate(invoice.periodStart)} - ${formatShortDate(invoice.periodEnd)}`,
    downloadUrl: null,
    id: invoice.id,
    status: invoice.status,
  }));
  const trialEligible = !user.agentTrialUsedAt && !previousSubscription;
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] overflow-x-clip bg-background px-4 pb-10 text-foreground sm:px-6 lg:px-10">
      <SettingsPageHeader title="Billing" />

      <div className="flex w-full flex-col gap-5 py-6">
        {!billing ? <CompactAgentUpgradeCta trialEligible={trialEligible} /> : null}
        {billing?.issue ? <BillingIssueNotice issue={billing.issue} /> : null}

        {billing ? (
          <>
            <CurrentPlanCard billing={billing} />
            <div className="grid gap-5 lg:grid-cols-2">
              <PaymentMethodCard billing={billing} />
              <SubscriptionDetails billing={billing} />
            </div>
          </>
        ) : null}

        <AdsBillingOverview summary={adsBillingSummary} />
        <AdsInvoiceHistory invoices={adsInvoiceRows} />
        {billing ? <InvoiceHistory invoices={billing.invoices} /> : null}

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <p className="flex items-center gap-3 text-sm font-normal text-muted-foreground">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HelpCircle className="size-4" />
            </span>
            <span>
              Need help? Visit our{" "}
              <Link href="#" className="font-bold text-primary">
                Help Centre
              </Link>{" "}
              or contact{" "}
              <Link href="mailto:support@homzie.co.za" className="font-bold text-primary">
                support@homzie.co.za
              </Link>
            </span>
          </p>
        </section>
      </div>
    </main>
  );
}

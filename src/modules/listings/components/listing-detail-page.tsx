"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import {
  Bath,
  BedDouble,
  CalendarDays,
  Car,
  Calculator,
  Edit3,
  Eye,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  HandCoins,
  Home,
  MapPin,
  ParkingCircle,
  Percent,
  Play,
  Ruler,
  Send,
  Sparkles,
  ShieldCheck,
  Trees,
  Upload,
  X,
} from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/modules/currency/currency-provider";
import {
  getListingOfferStatsAction,
  confirmListingReservationPayment,
  reopenReservedListing,
  startListingReservationCheckout,
  trackListingAction,
  trackListingView,
} from "@/modules/listings/actions";
import {
  ListingEngagementActions,
  ListingSaveButton,
} from "@/modules/listings/components/listing-card";
import { mandateTypeOptions } from "@/modules/listings/options";
import type { ListingDetailData } from "@/modules/listings/server/listing-data";
import {
  createOfferMessageAction,
  startListingInquiryAction,
} from "@/modules/messages/actions";

function featureHashtag(value: string) {
  return `#${value.replace(/\s+/g, "")}`;
}

function formatMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "0";
}

function formatDate(value: string) {
  if (!value) return "Dates not set";

  return value;
}

function mandateDates(startDate: string, endDate: string) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `Starts ${startDate}`;
  if (endDate) return `Ends ${endDate}`;

  return "Dates not set";
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function amountToCents(value: string) {
  const amount = Number(value.replace(/[^\d.]/g, ""));

  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function formatOfferAmount(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(Number(digits));
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

type ListingOfferStats = {
  averageAmountCents: number | null;
  count: number;
  currency: string;
  maxAmountCents: number | null;
  minAmountCents: number | null;
};

function getOfferStrengthScore({
  amountCents,
  askingPriceCents,
  stats,
}: {
  amountCents: number;
  askingPriceCents: number | null;
  stats: ListingOfferStats | null;
}) {
  if (
    stats?.count &&
    stats.minAmountCents !== null &&
    stats.maxAmountCents !== null
  ) {
    if (stats.maxAmountCents > stats.minAmountCents) {
      return clampPercent(
        ((amountCents - stats.minAmountCents) /
          (stats.maxAmountCents - stats.minAmountCents)) *
          100,
      );
    }

    return amountCents >= stats.maxAmountCents ? 85 : 30;
  }

  if (askingPriceCents && askingPriceCents > 0) {
    const deltaRatio = (amountCents - askingPriceCents) / askingPriceCents;

    return clampPercent(50 + deltaRatio * 500);
  }

  return 50;
}

function OfferStrengthInsight({
  amountCents,
  askingPriceCents,
  loading,
  stats,
}: {
  amountCents: number;
  askingPriceCents: number | null;
  loading: boolean;
  stats: ListingOfferStats | null;
}) {
  if (!amountCents) return null;

  const score = getOfferStrengthScore({ amountCents, askingPriceCents, stats });
  const strength =
    score >= 75 ? "Hot" : score >= 40 ? "Medium" : "Cold";
  const deltaPercent =
    askingPriceCents && askingPriceCents > 0
      ? ((amountCents - askingPriceCents) / askingPriceCents) * 100
      : null;
  const deltaLabel =
    deltaPercent === null
      ? null
      : Math.abs(deltaPercent) < 0.05
        ? "At asking price"
        : deltaPercent > 0
          ? `${Math.abs(deltaPercent).toFixed(1)}% increase above asking`
          : `${Math.abs(deltaPercent).toFixed(1)}% deduction from asking`;
  const statsLabel = loading
    ? "Checking competing offers..."
    : stats?.count
      ? `Compared with ${stats.count} active ${stats.count === 1 ? "offer" : "offers"} in ${stats.currency}.`
      : "No active competing offers in this currency yet.";

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-primary">
            Offer strength
          </p>
          <p className="mt-1 text-sm font-black">{strength}</p>
        </div>
        {deltaLabel ? (
          <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-black text-muted-foreground">
            {deltaLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <div className="relative h-2 rounded-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-500">
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-md"
            style={{ left: `${score}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-wide text-muted-foreground">
          <span>Cold</span>
          <span>Medium</span>
          <span>Hot</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">
        {statsLabel}
      </p>
    </div>
  );
}

function getListingViewerSessionId() {
  if (typeof window === "undefined") return "";

  const storageKey = "homzie-listing-viewer-session";
  const existing = window.localStorage.getItem(storageKey);

  if (existing) return existing;

  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(storageKey, nextId);

  return nextId;
}

function DetailStat({
  icon: Icon,
  value,
}: {
  icon: typeof BedDouble;
  value: string;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-foreground">
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <span>{value}</span>
    </span>
  );
}

function ListingOfferCountPill({ countLabel }: { countLabel: string }) {
  return (
    <span
      className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background/90 px-3 text-sm font-black shadow-sm backdrop-blur"
      title="Offers made on this listing"
    >
      <HandCoins className="size-4" />
      <span>{countLabel}</span>
    </span>
  );
}

function ListingMetaPanel({ listing }: { listing: ListingDetailData }) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-4 text-sm font-bold text-muted-foreground shadow-sm">
      <p className="flex items-center gap-2">
        <Home className="size-4" />
        {listing.propertyTypeLabel}
      </p>
      <p className="flex items-center gap-2">
        <CalendarDays className="size-4" />
        Listed {formatDate(listing.listedAt.slice(0, 10))}
      </p>
      <p className="flex items-center gap-2">
        <ShieldCheck className="size-4" />
        {statusLabel(listing.status)}
      </p>
    </div>
  );
}

function yesNoLabel(value: string) {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";

  return "";
}

function DetailDataTable({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <table className="w-full table-fixed text-left text-sm">
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.label} className="transition hover:bg-muted/35">
              <th
                scope="row"
                className="w-[46%] px-4 py-3 align-top text-xs font-black uppercase tracking-wide text-muted-foreground sm:w-1/3 sm:px-5"
              >
                {item.label}
              </th>
              <td className="break-words px-4 py-3 align-top font-black sm:px-5">
                {item.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BondCalculatorDialog({
  askingPriceCents,
  buyerIncentive,
  onOpen,
  transferCostsEstimateCents,
  formatPriceCents,
  triggerClassName,
}: {
  askingPriceCents: number;
  buyerIncentive: string | null;
  onOpen?: () => void;
  transferCostsEstimateCents: number | null;
  formatPriceCents: (value: number) => string;
  triggerClassName?: string;
}) {
  const [depositAmount, setDepositAmount] = useState("0");
  const [interestRate, setInterestRate] = useState("10.5");
  const [loanTermYears, setLoanTermYears] = useState(20);
  const depositCents = amountToCents(depositAmount);
  const principalCents = Math.max(0, askingPriceCents - depositCents);
  const monthlyRate = Math.max(0, Number(interestRate) || 0) / 100 / 12;
  const numberOfPayments = loanTermYears * 12;
  const monthlyRepaymentCents =
    numberOfPayments > 0 && monthlyRate > 0
      ? Math.round(
          principalCents *
            ((monthlyRate * (1 + monthlyRate) ** numberOfPayments) /
              ((1 + monthlyRate) ** numberOfPayments - 1)),
        )
      : numberOfPayments > 0
        ? Math.round(principalCents / numberOfPayments)
        : 0;
  const minimumIncomeCents = Math.round(monthlyRepaymentCents * 3.33);
  const onceOffCostsCents = transferCostsEstimateCents || 0;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline" className={triggerClassName} onClick={onOpen}>
          <Calculator className="size-4" />
          Bond calculator
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 top-1/2 z-[91] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-4 text-foreground shadow-2xl focus-visible:outline-none sm:mx-auto sm:max-w-3xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-black">
                Bond calculator
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm font-semibold text-muted-foreground">
                Estimate repayments using this listing&apos;s price.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close calculator">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-black">Purchase price</span>
                  <div className="flex h-11 items-center rounded-md border border-border bg-muted px-3 text-sm font-black">
                    {formatPriceCents(askingPriceCents)}
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Deposit</span>
                  <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/25">
                    <span className="text-sm font-black text-primary">
                      {formatPriceCents(0).replace(/[0-9.,\s]+/g, "").trim() ||
                        "R"}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={depositAmount}
                      onChange={(event) => setDepositAmount(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                    />
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">Interest rate</span>
                  <div className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/25">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={interestRate}
                      onChange={(event) => setInterestRate(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                    />
                    <Percent className="size-4 text-primary" />
                  </div>
                </label>

                <label className="grid gap-3">
                  <span className="flex items-center justify-between gap-3 text-sm font-black">
                    Loan term
                    <span className="text-primary">{loanTermYears} years</span>
                  </span>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={loanTermYears}
                    onChange={(event) =>
                      setLoanTermYears(Number(event.target.value))
                    }
                    className="h-2 w-full accent-primary"
                  />
                </label>
              </div>
            </div>

            <div className="grid content-start gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
              <div>
                <p className="text-sm font-bold text-muted-foreground">
                  Monthly repayment
                </p>
                <p className="mt-1 text-2xl font-black text-primary">
                  {formatPriceCents(monthlyRepaymentCents)}
                </p>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-start justify-between gap-3 text-sm font-semibold">
                <span className="text-muted-foreground">
                  Once-off costs estimate
                </span>
                <span className="font-black">
                  {onceOffCostsCents
                    ? formatPriceCents(onceOffCostsCents)
                    : "Not supplied"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 text-sm font-semibold">
                <span className="text-muted-foreground">
                  Suggested gross monthly income
                </span>
                <span className="font-black">
                  {formatPriceCents(minimumIncomeCents)}
                </span>
              </div>
              {buyerIncentive ? (
                <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-primary">
                  {buyerIncentive}
                </div>
              ) : null}
            </div>
          </div>

          <p className="mt-4 text-xs font-medium leading-5 text-muted-foreground">
            This is an estimate only. Actual repayment, fees, taxes and approval
            requirements depend on the lender, jurisdiction and your personal
            affordability assessment.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MakeOfferDialog({
  currencyPrefix,
  listing,
  onOfferStarted,
}: {
  currencyPrefix: string;
  listing: ListingDetailData;
  onOfferStarted?: () => void;
}) {
  const router = useRouter();
  const { currency } = useCurrency();
  const [amount, setAmount] = useState(
    listing.askingPriceCents
      ? formatOfferAmount(String(Math.round(listing.askingPriceCents / 100)))
      : "",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [offerStats, setOfferStats] = useState<ListingOfferStats | null>(null);
  const [offerStatsPending, startOfferStatsTransition] = useTransition();
  const [pending, startTransition] = useTransition();
  const amountCents = amountToCents(amount);

  useEffect(() => {
    let active = true;

    startOfferStatsTransition(async () => {
      try {
        const stats = await getListingOfferStatsAction({
          currency,
          listingId: listing.id,
        });

        if (active) setOfferStats(stats);
      } catch {
        if (active) setOfferStats(null);
      }
    });

    return () => {
      active = false;
    };
  }, [currency, listing.id]);

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline" onClick={onOfferStarted}>
          Place offer
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 top-1/2 z-[91] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-4 text-foreground shadow-2xl focus-visible:outline-none sm:mx-auto sm:max-w-lg sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-black">
                Make an offer
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm font-semibold text-muted-foreground">
                Your offer will start a direct conversation with the agent and
                attach this listing.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close offer">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
              <p className="line-clamp-2 text-sm font-black">{listing.title}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {listing.location || listing.city || "Listing"}
              </p>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-black">Offer amount</span>
              <div className="flex h-12 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:ring-2 focus-within:ring-primary/25">
                <span className="text-sm font-black text-primary">
                  {currencyPrefix}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(formatOfferAmount(event.target.value))}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                />
              </div>
            </label>

            <OfferStrengthInsight
              amountCents={amountCents}
              askingPriceCents={listing.askingPriceCents}
              loading={offerStatsPending}
              stats={offerStats}
            />

            <label className="grid gap-2">
              <span className="text-sm font-black">Message</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder="Add a note for the agent..."
                className="resize-none rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/25"
              />
            </label>

            {error ? (
              <p className="text-sm font-bold text-destructive">{error}</p>
            ) : null}

            <Button
              type="button"
              disabled={pending || !amount}
              onClick={() => {
                setError("");
                startTransition(async () => {
                  try {
                    const result = await createOfferMessageAction({
                      amountCents,
                      currency,
                      listingId: listing.id,
                      note,
                    });

                    router.push(`/messages?conversation=${result.conversationId}`);
                  } catch (offerError) {
                    setError(
                      offerError instanceof Error
                        ? offerError.message
                        : "Could not send this offer.",
                    );
                  }
                });
              }}
            >
              {pending ? "Sending offer..." : "Send offer"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type ReservationCheckout = {
  clientSecret: string;
  publishableKey: string;
  reservationId: string;
};

function ReservationPaymentForm({
  amountLabel,
  listingId,
  onError,
  onSuccess,
}: {
  amountLabel: string;
  listingId: string;
  onError: (message: string) => void;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");

    if (!stripe || !elements) {
      onError("Secure payment form is still loading. Try again in a moment.");
      return;
    }

    startTransition(async () => {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}?reservation=success`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        onError(result.error.message || "Your payment could not be confirmed.");
        return;
      }

      if (!result.paymentIntent?.id) {
        onError("Payment confirmation was incomplete.");
        return;
      }

      const confirmed = await confirmListingReservationPayment(result.paymentIntent.id);

      if (!confirmed.ok) {
        onError(confirmed.error || "Payment succeeded, but reservation confirmation failed.");
        return;
      }

      await trackListingAction({
        actionType: "reserve_now",
        listingId,
        source: "listing_detail_payment_confirmed",
        viewerSessionId: `payment-${result.paymentIntent.id}`,
      });

      onSuccess();
    });
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={onSubmit}>
      <div className="rounded-lg border border-border bg-background p-3">
        <PaymentElement
          options={{
            business: {
              name: "Homzie",
            },
            layout: "tabs",
          }}
        />
      </div>
      <Button
        type="submit"
        disabled={!stripe || !elements || pending}
        className="h-12 w-full"
      >
        {pending ? "Securing reservation..." : `Reserve now - ${amountLabel}`}
      </Button>
      <p className="text-center text-[11px] font-bold leading-4 text-muted-foreground">
        Card details are encrypted and processed by Stripe inside this Homzie flow.
        Homzie never stores your card details.
      </p>
    </form>
  );
}

function ReserveListingDialog({
  formatPriceCents,
  listing,
  onReserveStarted,
}: {
  formatPriceCents: (value: number) => string;
  listing: ListingDetailData;
  onReserveStarted?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState<ReservationCheckout | null>(null);
  const [success, setSuccess] = useState(false);
  const [intentPending, startIntentTransition] = useTransition();

  if (
    !listing.reservationEnabled ||
    !listing.reservationAmountCents ||
    !listing.reservationTotalCents
  ) {
    return null;
  }

  const rows = [
    ["Reservation amount", listing.reservationAmountCents],
    ["Homzie fee", listing.reservationPlatformFeeCents],
    ["Payment fee estimate", listing.reservationProcessingFeeCents],
    ["Total today", listing.reservationTotalCents],
  ] as const;
  const totalLabel = formatPriceCents(listing.reservationTotalCents);
  const stripePromise = checkout?.publishableKey
    ? loadStripe(checkout.publishableKey)
    : null;

  function prepareReservationIntent() {
    if (checkout || intentPending || success) return;

    setError("");
    startIntentTransition(async () => {
      const result = await startListingReservationCheckout(listing.id);

      if (!result.ok || !result.clientSecret || !result.publishableKey) {
        setError(result.error || "Could not prepare the secure payment form.");
        return;
      }

      setCheckout({
        clientSecret: result.clientSecret,
        publishableKey: result.publishableKey,
        reservationId: result.reservationId,
      });
    });
  }
  const closeDisabled = intentPending;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && closeDisabled) return;

        setOpen(nextOpen);

        if (nextOpen) {
          onReserveStarted?.();
          prepareReservationIntent();
        }

        if (!nextOpen) {
          setError("");
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button>
          Reserve now - {formatPriceCents(listing.reservationAmountCents)}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 top-1/2 z-[91] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background text-foreground shadow-2xl focus-visible:outline-none sm:mx-auto sm:max-w-xl">
          <div className="border-b border-border bg-muted/25 px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-background shadow-sm">
                    <Image
                      src="/logo/homzie-logo-dark-tight.png"
                      alt="Homzie"
                      width={30}
                      height={30}
                      className="size-8 object-contain"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                      Homzie secure reservation
                    </p>
                    <Dialog.Title className="mt-1 text-xl font-black leading-tight sm:text-2xl">
                      Reserve this listing
                    </Dialog.Title>
                  </div>
                </div>
                <Dialog.Description className="mt-3 text-sm font-semibold leading-6 text-muted-foreground">
                  Complete the secure card form inside Homzie. The listing is marked
                  reserved only after payment succeeds.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close reservation"
                  disabled={closeDisabled}
                >
                  <X className="size-5" />
                </Button>
              </Dialog.Close>
            </div>
          </div>

          <div className="px-4 py-5 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <ShieldCheck className="size-5 text-primary" />
                <p className="mt-2 text-xs font-black">Secure payment</p>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-muted-foreground">
                  Encrypted card capture inside Homzie.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <HandCoins className="size-5 text-primary" />
                <p className="mt-2 text-xs font-black">Funds controlled</p>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-muted-foreground">
                  Release requires agency documentation.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <BadgeCheck className="size-5 text-primary" />
                <p className="mt-2 text-xs font-black">Listing held</p>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-muted-foreground">
                  The listing is marked reserved after payment.
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    Reservation checkout
                  </p>
                  <p className="mt-1 text-sm font-black">{listing.title}</p>
                </div>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary">
                  In-app payment
                </span>
              </div>
              {rows.map(([label, amount], index) => (
                <div
                  key={label}
                  className={cn(
                    "flex items-center justify-between gap-4 px-4 py-3 text-sm font-bold",
                    index < rows.length - 1 && "border-b border-border",
                    label === "Total today" && "bg-primary/10 text-primary",
                  )}
                >
                  <span>{label}</span>
                  <span>{formatPriceCents(amount)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                What happens next
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-muted-foreground">
                {listing.reservationTermsText}
              </p>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
                {error}
              </p>
            ) : null}

            {success ? (
              <div className="mt-5 overflow-hidden rounded-lg border border-primary/25 bg-primary/10">
                <div className="px-5 py-6 text-center">
                  <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <CheckCircle2 className="size-9" />
                  </span>
                  <p className="mt-4 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                    <Sparkles className="size-4" />
                    Reservation confirmed
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight">
                    Well done, this property is reserved for you.
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-muted-foreground">
                    Your payment was successful and Homzie has marked the listing
                    as reserved while the agency confirms the next steps.
                  </p>
                </div>
                <div className="grid gap-px bg-border sm:grid-cols-3">
                  <div className="bg-background p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Paid today
                    </p>
                    <p className="mt-1 text-lg font-black text-primary">
                      {totalLabel}
                    </p>
                  </div>
                  <div className="bg-background p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Status
                    </p>
                    <p className="mt-1 text-lg font-black">Reserved</p>
                  </div>
                  <div className="bg-background p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Next step
                    </p>
                    <p className="mt-1 text-lg font-black">Agency review</p>
                  </div>
                </div>
                <div className="space-y-3 px-5 py-5">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
                      What happens now
                    </p>
                    <ul className="mt-3 grid gap-2 text-xs font-semibold leading-5 text-muted-foreground">
                      <li>Homzie has notified the agent about your reservation.</li>
                      <li>The agency must provide the required documentation.</li>
                      <li>Funds are only released after Homzie reviews and approves the payout.</li>
                    </ul>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Dialog.Close asChild>
                      <Button type="button" className="h-11">
                        Done
                      </Button>
                    </Dialog.Close>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      onClick={() => {
                        router.refresh();
                      }}
                    >
                      View reserved listing
                    </Button>
                  </div>
                </div>
              </div>
            ) : intentPending ? (
              <div className="mt-5 rounded-lg border border-border bg-card p-4 text-center text-sm font-bold text-muted-foreground">
                Preparing secure payment form...
              </div>
            ) : checkout && stripePromise ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: checkout.clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      borderRadius: "8px",
                      colorPrimary: "#7b5cff",
                      fontFamily: "Poppins, system-ui, sans-serif",
                    },
                  },
                }}
              >
                <ReservationPaymentForm
                  amountLabel={totalLabel}
                  listingId={listing.id}
                  onError={setError}
                  onSuccess={() => {
                    setSuccess(true);
                    router.refresh();
                    window.history.replaceState(
                      null,
                      "",
                      `${window.location.pathname}?reservation=success`,
                    );
                  }}
                />
              </Elements>
            ) : (
              <Button
                type="button"
                className="mt-5 h-12 w-full"
                onClick={prepareReservationIntent}
              >
                Load secure payment form
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SendListingMessageButton({
  listing,
  onSent,
}: {
  listing: ListingDetailData;
  onSent?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <Button
        type="button"
        disabled={pending}
        className="h-12 w-full rounded-md border-transparent bg-[image:var(--homzie-gradient)] text-sm font-black text-white shadow-[0_14px_30px_rgba(123,92,255,0.25)] hover:opacity-95"
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              const listingUrl =
                typeof window !== "undefined"
                  ? new URL(listing.href, window.location.origin).toString()
                  : listing.href;
              const clientId =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? `listing-inquiry-${crypto.randomUUID()}`
                  : `listing-inquiry-${Date.now()}`;
              const result = await startListingInquiryAction({
                body: `Hi ${listing.agent.name}, I'm interested in this listing: ${listing.title}\n${listingUrl}`,
                clientId,
                listingId: listing.id,
              });

              onSent?.();
              router.push(`/messages?conversation=${result.conversationId}`);
            } catch (messageError) {
              setError(
                messageError instanceof Error
                  ? messageError.message
                  : "Could not start this chat.",
              );
            }
          });
        }}
      >
        <Send className="size-4" />
        {pending ? "Opening chat..." : "Send message"}
      </Button>
      {error ? (
        <p className="mt-2 text-xs font-bold text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function ListingDescription({ value }: { value: string | null }) {
  if (!value) {
    return (
      <p className="text-sm font-normal leading-7 text-muted-foreground">
        No description has been added yet.
      </p>
    );
  }

  return (
    <div
      className="space-y-4 text-sm font-normal leading-7 text-foreground/80 [&_em]:italic [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_strong]:font-bold [&_ul]:space-y-2"
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}

function AgentProfileCard({
  agentHref,
  listing,
  locked,
  onAction,
}: {
  agentHref: string;
  listing: ListingDetailData;
  locked?: boolean;
  onAction?: (
    actionType: "call_agent" | "contact_agent" | "email_agent" | "whatsapp_agent",
  ) => void;
}) {
  const actionsDisabled = listing.isUnavailableForViewer;
  const signupHref = `/register?callbackUrl=${encodeURIComponent(listing.href)}`;

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div
        className={cn(
          "transition",
          locked && "pointer-events-none select-none blur-sm",
        )}
        aria-hidden={locked ? true : undefined}
      >
        <div className="flex items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-black text-primary ring-4 ring-primary/10">
            {listing.agent.avatarUrl ? (
              <Image
                src={listing.agent.avatarUrl}
                alt=""
                width={64}
                height={64}
                className="size-full object-cover"
              />
            ) : (
              listing.agent.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-lg font-black">{listing.agent.name}</p>
              <span
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full [background:var(--homzie-gradient)] text-white shadow-lg shadow-primary/20 ring-2 ring-background"
                title="Verified Homzie agent"
              >
                <BadgeCheck className="size-3.5" />
              </span>
            </div>
            <p className="truncate text-xs font-bold text-muted-foreground">
              {listing.agent.username
                ? `@${listing.agent.username}`
                : "Homzie agent"}
            </p>
            {listing.agent.location ? (
              <p className="mt-2 truncate text-xs font-bold text-muted-foreground">
                {listing.agent.location}
              </p>
            ) : null}
          </div>
        </div>
        {listing.agent.bio ? (
          <p className="mt-4 whitespace-pre-line text-sm font-medium leading-6 text-foreground/80">
            {listing.agent.bio}
          </p>
        ) : null}
        {listing.agent.contactEmail ||
        listing.agent.contactPhone ||
        listing.agent.whatsappNumber ? (
          <div className="mt-4">
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Contact agent
            </p>
            <div className="mt-1 flex max-w-full flex-col items-start gap-1 text-sm font-bold text-primary">
            {listing.agent.contactEmail ? (
              actionsDisabled ? (
                <span className="max-w-full break-all text-muted-foreground">
                  {listing.agent.contactEmail}
                </span>
              ) : (
                <a
                  href={`mailto:${listing.agent.contactEmail}`}
                  className="max-w-full break-all hover:underline"
                  onClick={() => onAction?.("email_agent")}
                >
                  {listing.agent.contactEmail}
                </a>
              )
            ) : null}
            {listing.agent.contactPhone ? (
              actionsDisabled ? (
                <span className="text-muted-foreground">
                  {listing.agent.contactPhone}
                </span>
              ) : (
                <a
                  href={`tel:${listing.agent.contactPhone}`}
                  className="hover:underline"
                  onClick={() => onAction?.("call_agent")}
                >
                  {listing.agent.contactPhone}
                </a>
              )
            ) : null}
            {listing.agent.whatsappNumber ? (
              actionsDisabled ? (
                <span className="text-muted-foreground">
                  WhatsApp {listing.agent.whatsappNumber}
                </span>
              ) : (
                <a
                  href={`https://wa.me/${listing.agent.whatsappNumber.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                  onClick={() => onAction?.("whatsapp_agent")}
                >
                  WhatsApp {listing.agent.whatsappNumber}
                </a>
              )
            ) : null}
            </div>
          </div>
        ) : null}
        {actionsDisabled ? (
          <div className="mt-4 grid gap-2">
            <Button className="h-12 w-full rounded-md border-transparent bg-[image:var(--homzie-gradient)] text-sm font-black text-white opacity-60 shadow-[0_14px_30px_rgba(123,92,255,0.25)]" disabled>
              <Send className="size-4" />
              Send message
            </Button>
            <Button variant="outline" className="h-12 w-full rounded-md" disabled>
              <Eye className="size-4" />
              View agent profile
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <SendListingMessageButton
              listing={listing}
              onSent={() => onAction?.("contact_agent")}
            />
            <Button asChild variant="outline" className="h-12 w-full rounded-md">
              <Link href={agentHref}>
                <Eye className="size-4" />
                View agent profile
              </Link>
            </Button>
          </div>
        )}
      </div>
      {locked ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-background/55 p-5 text-center backdrop-blur-[1px]">
          <div className="max-w-64">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Eye className="size-5" />
            </span>
            <p className="mt-3 text-sm font-black">Create an account to reveal</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
              Sign up to view agent details and contact this listing owner.
            </p>
            <Button asChild className="mt-4 h-10 w-full">
              <Link href={signupHref}>Reveal agent</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ListingDetailPage({
  listing,
  viewerSignedIn = false,
  viewerRole,
  viewerUsername,
}: {
  listing: ListingDetailData;
  viewerSignedIn?: boolean;
  viewerRole?: "user" | "admin";
  viewerUsername?: string;
}) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const hasTrackedViewRef = useRef(false);
  const { formatPriceCents, formatPriceLabel } = useCurrency();
  const mediaItems = useMemo(
    () => {
      const seen = new Set<string>();
      const items: Array<{ type: string; url: string }> = [];

      if (listing.coverImageUrl) {
        seen.add(listing.coverImageUrl);
        items.push({ type: "image/webp", url: listing.coverImageUrl });
      }

      listing.media.forEach((item) => {
        if (!item.previewUrl || seen.has(item.previewUrl)) return;

        seen.add(item.previewUrl);
        items.push({
          type: item.type || "image/webp",
          url: item.previewUrl,
        });
      });

      return items;
    },
    [listing.coverImageUrl, listing.media],
  );
  const safeActiveMediaIndex = mediaItems.length
    ? Math.min(activeMediaIndex, mediaItems.length - 1)
    : 0;
  const activeMedia = mediaItems[safeActiveMediaIndex] || null;
  const activeMediaIsVideo = Boolean(activeMedia?.type.startsWith("video/"));
  const showGalleryControls = mediaItems.length > 1;
  const formattedPrice =
    listing.askingPriceCents && listing.askingPriceCents > 0
      ? formatPriceCents(listing.askingPriceCents)
      : formatPriceLabel(listing.priceLabel) || "Price not set";
  const currencyPrefix =
    formatPriceCents(0).replace(/[0-9.,\s]+/g, "").trim() || "R";
  const price =
    listing.listingType === "rental" &&
    listing.askingPriceCents &&
    listing.askingPriceCents > 0
      ? `${formattedPrice}/month`
      : formattedPrice;
  const showBondCalculator =
    !listing.isUnavailableForViewer &&
    listing.listingType !== "rental" &&
    Boolean(listing.askingPriceCents) &&
    Number(listing.askingPriceCents) > 0;
  const showReducedPrice =
    Boolean(listing.askingPriceCents) &&
    Number(listing.previousAskingPriceCents || 0) >
      Number(listing.askingPriceCents || 0);
  const canUseListingActions = !listing.isUnavailableForViewer;
  const mandateOption =
    mandateTypeOptions.find((option) => option.value === listing.mandateType) ||
    mandateTypeOptions[0];
  const MandateIcon = mandateOption.icon;
  const agentHref = listing.agent.username
    ? `/users/${listing.agent.username}`
    : "/agents";
  const ownershipCosts = [
    {
      label: "Local taxes",
      value: listing.localTaxesCents
        ? formatPriceCents(listing.localTaxesCents)
        : "",
    },
    {
      label: "Community fees",
      value: listing.communityFeesCents
        ? formatPriceCents(listing.communityFeesCents)
        : "",
    },
    {
      label: "Utilities estimate",
      value: listing.utilitiesEstimateCents
        ? formatPriceCents(listing.utilitiesEstimateCents)
        : "",
    },
    {
      label: "Insurance estimate",
      value: listing.insuranceEstimateCents
        ? formatPriceCents(listing.insuranceEstimateCents)
        : "",
    },
    {
      label: "Transfer costs estimate",
      value: listing.transferCostsEstimateCents
        ? formatPriceCents(listing.transferCostsEstimateCents)
        : "",
    },
    {
      label: "Rental yield estimate",
      value: listing.rentalYield ? `${listing.rentalYield}%` : "",
    },
  ].filter((item) => item.value);
  const availabilityDetails = [
    {
      label:
        listing.listingType === "rental"
          ? "Available from"
          : "Occupation / available date",
      value: listing.availableFrom || "",
    },
    {
      label: "Furnished",
      value: yesNoLabel(listing.furnishedStatus),
    },
    {
      label: "Pets allowed",
      value: yesNoLabel(listing.petsAllowed),
    },
    {
      label: "Short-let allowed",
      value: yesNoLabel(listing.shortLetAllowed),
    },
  ].filter((item) => item.value);
  const recordListingAction = (
    actionType:
      | "bond_calculator"
      | "call_agent"
      | "contact_agent"
      | "email_agent"
      | "like"
      | "place_offer"
      | "reserve_now"
      | "save"
      | "share"
      | "whatsapp_agent",
  ) => {
    void trackListingAction({
      actionType,
      listingId: listing.id,
      source: "listing_detail",
      viewerSessionId: getListingViewerSessionId(),
    });
  };
  useEffect(() => {
    if (hasTrackedViewRef.current) return;

    hasTrackedViewRef.current = true;
    void trackListingView({
      listingId: listing.id,
      source: "listing_detail",
      viewerSessionId: getListingViewerSessionId(),
    });
  }, [listing.id]);
  const showPreviousMedia = () => {
    setActiveMediaIndex((index) =>
      mediaItems.length ? (index - 1 + mediaItems.length) % mediaItems.length : 0,
    );
  };
  const showNextMedia = () => {
    setActiveMediaIndex((index) =>
      mediaItems.length ? (index + 1) % mediaItems.length : 0,
    );
  };
  const editListingAction = listing.isOwner ? (
    <Button asChild>
      <Link href={`/listings/${listing.id}/edit`}>
        <Edit3 className="size-4" />
        Edit listing
      </Link>
    </Button>
  ) : null;
  const reopenReservationAction =
    listing.isOwner && listing.status === "reserved" ? (
      <form action={reopenReservedListing}>
        <input type="hidden" name="listingId" value={listing.id} />
        <Button type="submit" variant="outline">
          Reopen reservations
        </Button>
      </form>
    ) : null;
  const reserveNowAction =
    canUseListingActions && listing.listingType !== "rental" ? (
      <ReserveListingDialog
        formatPriceCents={formatPriceCents}
        listing={listing}
        onReserveStarted={() => recordListingAction("reserve_now")}
      />
    ) : null;
  const placeOfferAction = canUseListingActions && listing.listingType !== "rental" ? (
    <MakeOfferDialog
      currencyPrefix={currencyPrefix}
      listing={listing}
      onOfferStarted={() => recordListingAction("place_offer")}
    />
  ) : null;
  const purchaseActions = (
    <>
      {reserveNowAction}
      {placeOfferAction}
    </>
  );
  const listingToolActions = canUseListingActions ? (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <ListingEngagementActions
        listing={{
          id: listing.id,
          likedByViewer: listing.likedByViewer,
          likeCountLabel: listing.likeCountLabel,
          savedByViewer: listing.savedByViewer,
          saveCountLabel: listing.saveCountLabel,
        }}
        onLike={() => recordListingAction("like")}
        onSave={() => recordListingAction("save")}
      />
      <ListingOfferCountPill countLabel={listing.offerCountLabel} />
    </div>
  ) : listing.savedByViewer ? (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <ListingSaveButton
        countLabel={listing.saveCountLabel}
        initialSaved={listing.savedByViewer}
        listingId={listing.id}
        onSave={() => recordListingAction("save")}
      />
      <ListingOfferCountPill countLabel={listing.offerCountLabel} />
    </div>
  ) : null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-background pt-20 pb-48 text-foreground lg:pb-0">
      <GlobalHeader viewerRole={viewerRole} viewerUsername={viewerUsername} />
      <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <section className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="relative aspect-[4/3] bg-muted sm:aspect-[16/10]">
                {activeMediaIsVideo && activeMedia ? (
                  <video
                    key={activeMedia.url}
                    src={activeMedia.url}
                    className={cn(
                      "size-full object-cover",
                      listing.isUnavailableForViewer && "grayscale",
                    )}
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : activeMedia?.url ? (
                  <Image
                    src={activeMedia.url}
                    alt={listing.title}
                    fill
                    priority
                    className={cn(
                      "object-cover",
                      listing.isUnavailableForViewer && "grayscale",
                    )}
                  />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <Upload className="size-10" />
                  </div>
                )}
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide">
                  {listing.isUnavailableForViewer
                    ? listing.statusLabel
                    : listing.listingTypeLabel}
                </span>
                {listing.buyerIncentive && canUseListingActions ? (
                  <span className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] truncate rounded-full bg-primary px-3 py-1.5 text-xs font-black uppercase tracking-wide text-primary-foreground shadow-lg">
                    {listing.buyerIncentive}
                  </span>
                ) : null}
                {activeMediaIsVideo ? (
                  <span className="absolute right-4 bottom-4 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-foreground shadow-sm backdrop-blur">
                    <Play className="size-3 fill-current" />
                    Video
                  </span>
                ) : null}
                {showGalleryControls ? (
                  <>
                    <button
                      type="button"
                      aria-label="Previous listing media"
                      className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-black shadow-lg transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={showPreviousMedia}
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next listing media"
                      className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-black shadow-lg transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={showNextMedia}
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                ) : null}
              </div>
              {showGalleryControls ? (
                <div className="flex max-w-full snap-x gap-2 overflow-x-auto overscroll-x-contain p-3 [scrollbar-width:thin]">
                  {mediaItems.map((item, index) => {
                    const isVideo = item.type.startsWith("video/");

                    return (
                      <button
                        key={`${item.url}-${index}`}
                        type="button"
                        aria-label={`Show listing ${isVideo ? "video" : "image"} ${index + 1}`}
                        className={cn(
                          "relative h-16 w-24 shrink-0 snap-start overflow-hidden rounded-md border bg-muted",
                          index === safeActiveMediaIndex
                            ? "border-primary ring-2 ring-primary/25"
                            : "border-border",
                        )}
                        onClick={() => setActiveMediaIndex(index)}
                      >
                        {isVideo ? (
                          <>
                            <video
                              src={item.url}
                              className={cn(
                                "size-full object-cover",
                                listing.isUnavailableForViewer && "grayscale",
                              )}
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <span className="absolute inset-0 grid place-items-center bg-black/20 text-white">
                              <Play className="size-5 fill-current drop-shadow" />
                            </span>
                          </>
                        ) : (
                          <Image
                            src={item.url}
                            alt=""
                            fill
                            className={cn(
                              "object-cover",
                              listing.isUnavailableForViewer && "grayscale",
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <section className="mt-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-primary">
                    {listing.isUnavailableForViewer
                      ? listing.statusLabel
                      : listing.propertyTypeLabel}
                  </p>
                  <h1 className="mt-2 max-w-4xl text-2xl font-black leading-tight sm:text-3xl">
                    {listing.title}
                  </h1>
                  <p className="mt-3 flex items-start gap-2 text-sm font-bold text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {listing.location || "Location not set"}
                  </p>
                  {listingToolActions}
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  {listing.isOwner ? editListingAction : null}
                </div>
              </div>
            </section>

            <section className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <DetailStat icon={BedDouble} value={`${formatMetric(listing.bedrooms)} beds`} />
              <DetailStat icon={Bath} value={`${formatMetric(listing.bathrooms)} baths`} />
              <DetailStat icon={Car} value={`${formatMetric(listing.garages)} garages`} />
              <DetailStat icon={ParkingCircle} value={`${formatMetric(listing.parking)} parking`} />
              <DetailStat icon={Ruler} value={`${formatMetric(listing.floorSize)}m² floor`} />
              <DetailStat icon={Trees} value={`${formatMetric(listing.erfSize)}m² erf`} />
            </section>

            {listing.isUnavailableForViewer ? (
              <section className="mt-6 rounded-lg border border-border bg-muted/60 p-5 text-foreground shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                  Listing {listing.statusLabel.toLowerCase()}
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {listing.status === "reserved"
                    ? "This listing is reserved."
                    : "This listing is no longer active."}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                  {listing.status === "reserved"
                    ? "A buyer has paid the reservation amount. Buyer actions are disabled while the agent and agency confirm the deal."
                    : "The agent has removed, archived, or completed this listing. Listing actions are disabled. If it is saved, you can still remove it using the bookmark action above."}
                </p>
                {reopenReservationAction ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {reopenReservationAction}
                  </div>
                ) : null}
              </section>
            ) : null}

            {listing.features.length ? (
              <section className="mt-8">
                <h2 className="text-xl font-black">Features</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.features.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary"
                    >
                      {featureHashtag(feature)}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-8 lg:hidden">
              <ListingMetaPanel listing={listing} />
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-black">Description</h2>
              <div className="mt-4 rounded-lg border border-border bg-card p-5 text-card-foreground">
                <ListingDescription value={listing.description} />
              </div>
            </section>

            {ownershipCosts.length ? (
              <section className="mt-8">
                <div>
                  <h2 className="text-xl font-black">Ownership costs</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                    Local running costs and estimates added by the agent.
                  </p>
                </div>
                <DetailDataTable items={ownershipCosts} />
              </section>
            ) : null}

            {availabilityDetails.length ? (
              <section className="mt-8">
                <h2 className="text-xl font-black">Availability and rules</h2>
                <DetailDataTable items={availabilityDetails} />
              </section>
            ) : null}

            {showBondCalculator ? (
              <section className="mt-8">
                <div className="relative overflow-hidden rounded-lg border border-primary/25 bg-card text-card-foreground shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-1 [background:var(--homzie-gradient)]" />
                  <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
                    <div className="flex min-w-0 gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Calculator className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-primary">
                          Buying tools
                        </p>
                        <h2 className="mt-1 text-xl font-black">
                          Bond calculator
                        </h2>
                        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                          Estimate the repayment, once-off costs and income guide for this listing.
                        </p>
                      </div>
                    </div>
                    <div className="sm:justify-self-end">
                      <BondCalculatorDialog
                        askingPriceCents={Number(listing.askingPriceCents)}
                        buyerIncentive={listing.buyerIncentive}
                        onOpen={() => recordListingAction("bond_calculator")}
                        transferCostsEstimateCents={listing.transferCostsEstimateCents}
                        formatPriceCents={formatPriceCents}
                        triggerClassName="w-full border-transparent [background:var(--homzie-gradient)] text-white shadow-lg shadow-primary/20 hover:opacity-95 sm:w-auto"
                      />
                      <p className="mt-2 text-center text-[11px] font-bold text-muted-foreground sm:text-right">
                        Quick estimate only
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="hidden rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm lg:block">
              {listing.priceQualifier ? (
                <p className="text-xs font-black uppercase tracking-wide text-primary">
                  {listing.priceQualifier}
                </p>
              ) : null}
              <p className={listing.priceQualifier ? "mt-1 text-3xl font-black" : "text-3xl font-black"}>
                {price}
              </p>
              {showReducedPrice ? (
                <p className="mt-1 text-sm font-black text-red-600">
                  Reduced from{" "}
                  <span className="text-muted-foreground line-through">
                    {formatPriceCents(Number(listing.previousAskingPriceCents))}
                  </span>
                </p>
              ) : null}
              {listing.buyerIncentive && canUseListingActions ? (
                <p className="mt-4 inline-flex rounded-full bg-primary px-3 py-1.5 text-xs font-black uppercase tracking-wide text-primary-foreground">
                  {listing.buyerIncentive}
                </p>
              ) : null}
              <div className="mt-5 grid gap-2">
                {canUseListingActions ? purchaseActions : null}
              </div>
            </div>

            <div className="hidden rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm lg:block">
              <Image
                src="/badges/Stripe%20Secure%20Checkout%20Badge.png"
                alt="Secure checkout powered by Stripe"
                width={502}
                height={131}
                className="h-auto w-full"
              />
            </div>

            <AgentProfileCard
              agentHref={agentHref}
              listing={listing}
              locked={!viewerSignedIn}
              onAction={recordListingAction}
            />

            <div className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <MandateIcon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-black">{listing.mandateTypeLabel}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">
                    {mandateDates(listing.mandateStartDate, listing.mandateEndDate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <ListingMetaPanel listing={listing} />
            </div>
          </aside>
        </section>
      </div>
      <GlobalFooter viewerRole={viewerRole} viewerUsername={viewerUsername} />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,15,22,0.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-7xl gap-2">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {listing.priceQualifier ? (
                <p className="truncate text-[10px] font-black uppercase tracking-wide text-primary">
                  {listing.priceQualifier}
                </p>
              ) : null}
              <p className="truncate text-lg font-black">
                {price}
              </p>
              {showReducedPrice ? (
                <p className="truncate text-xs font-black text-red-600">
                  Reduced from{" "}
                  <span className="text-muted-foreground line-through">
                    {formatPriceCents(Number(listing.previousAskingPriceCents))}
                  </span>
                </p>
              ) : null}
              {listing.buyerIncentive && canUseListingActions ? (
                <p className="mt-1 truncate text-[10px] font-black uppercase tracking-wide text-primary">
                  {listing.buyerIncentive}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2">
            {canUseListingActions ? purchaseActions : null}
            {listing.isOwner ? editListingAction : null}
          </div>
        </div>
      </div>
    </main>
  );
}

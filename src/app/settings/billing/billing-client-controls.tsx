"use client";

import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  Check,
  Download,
  Loader2,
  MoreHorizontal,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cancelAgentSubscription } from "@/modules/billing/portal-actions";
import {
  applyRetentionDiscount,
  createPaymentMethodSetupIntent,
  getRetentionOfferState,
  removePaymentMethod,
  saveDefaultPaymentMethod,
  setDefaultPaymentMethod,
  type RetentionOfferState,
} from "./actions";

export type BillingInvoiceRow = {
  amount: string;
  date: string;
  description: string;
  downloadUrl: string | null;
  id: string;
  status: string;
};

export type BillingPaymentMethodRow = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

function ModalShell({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg bg-background p-5 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
        <h3 className="pr-12 text-2xl font-bold tracking-normal">{title}</h3>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function AddPaymentMethodForm({
  onSaved,
}: {
  onSaved: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!stripe || !elements) {
      setError("Stripe is still loading. Try again in a moment.");
      return;
    }

    startTransition(async () => {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/settings/billing`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setError(result.error.message || "Could not save payment method.");
        return;
      }

      if (!result.setupIntent) {
        setError("Could not save payment method.");
        return;
      }

      const saved = await saveDefaultPaymentMethod(result.setupIntent.id);

      if (!saved.ok) {
        setError(saved.error);
        return;
      }

      onSaved();
      window.location.reload();
    });
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="rounded-lg border border-border bg-card p-3">
        <PaymentElement
          options={{
            layout: "tabs",
            business: {
              name: "Homzie",
            },
          }}
        />
      </div>
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        className="h-11 w-full"
        disabled={!stripe || !elements || isPending}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Save payment method
      </Button>
    </form>
  );
}

export function AddPaymentMethodButton({
  disabled,
  label = "Add method",
}: {
  disabled?: boolean;
  label?: string;
}) {
  const [setup, setSetup] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const stripePromise = setup?.publishableKey
    ? loadStripe(setup.publishableKey)
    : null;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || isPending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await createPaymentMethodSetupIntent();

            if (!result.ok) {
              setError(result.error);
              return;
            }

            setSetup({
              clientSecret: result.clientSecret,
              publishableKey: result.publishableKey,
            });
          });
        }}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {label}
      </Button>
      {error ? (
        <p className="mt-3 text-xs font-semibold text-destructive">{error}</p>
      ) : null}
      {setup && stripePromise ? (
        <ModalShell title="Add payment method" onClose={() => setSetup(null)}>
          <p className="mb-5 text-sm font-semibold leading-6 text-muted-foreground">
            Add a card securely inside Homzie. Stripe stores the payment method for
            future subscription renewals.
          </p>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: setup.clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#7b5cff",
                  borderRadius: "8px",
                  fontFamily: "Poppins, system-ui, sans-serif",
                },
              },
            }}
          >
            <AddPaymentMethodForm onSaved={() => setSetup(null)} />
          </Elements>
        </ModalShell>
      ) : null}
    </>
  );
}

export function PaymentMethodList({
  hasProtectedSubscription,
  methods,
}: {
  hasProtectedSubscription: boolean;
  methods: BillingPaymentMethodRow[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      {methods.map((method) => {
        const canRemove =
          !hasProtectedSubscription || !method.isDefault || methods.length > 1;

        return (
          <div
            key={method.id}
            className="rounded-lg border border-border bg-background p-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-sm font-bold uppercase text-primary">
                {method.brand.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="font-bold capitalize">
                  {method.brand} •••• {method.last4}
                </p>
                <p className="text-sm text-muted-foreground">
                  Expires {String(method.expMonth).padStart(2, "0")}/
                  {String(method.expYear).slice(-2)}
                </p>
              </div>
              {method.isDefault ? (
                <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  Default
                </span>
              ) : null}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="ml-auto grid size-9 place-items-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground"
                    aria-label={`Manage payment method ending ${method.last4}`}
                    disabled={isPending}
                  >
                    {isPending && pendingId === method.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="size-4" />
                    )}
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 min-w-44 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl"
                  >
                    {!method.isDefault ? (
                      <DropdownMenu.Item
                        className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        onSelect={(event) => {
                          event.preventDefault();
                          setError("");
                          setPendingId(method.id);
                          startTransition(async () => {
                          const result = await setDefaultPaymentMethod(method.id);
                          setPendingId(null);

                          if (!result.ok) {
                            setError(result.error);
                            return;
                          }

                          router.refresh();
                        });
                      }}
                      >
                        <Check className="size-4 text-primary" />
                        Make default
                      </DropdownMenu.Item>
                    ) : null}
                    <DropdownMenu.Item
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                      onSelect={(event) => {
                        event.preventDefault();
                        setError("");
                        setPendingId(method.id);
                        startTransition(async () => {
                          const result = await removePaymentMethod(method.id);
                          setPendingId(null);

                          if (!result.ok) {
                            setError(result.error);
                            return;
                          }

                          router.refresh();
                        });
                      }}
                      disabled={!canRemove}
                    >
                      <Trash2 className="size-4 text-destructive" />
                      Remove
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
            {!canRemove ? (
              <p className="mt-3 text-xs font-semibold text-muted-foreground">
                Add another payment method before removing the default card for this active subscription.
              </p>
            ) : null}
          </div>
        );
      })}
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CancelSubscriptionButton({
  disabled,
  retentionOffer,
}: {
  disabled?: boolean;
  retentionOffer: RetentionOfferState;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<RetentionOfferState>(retentionOffer);
  const [step, setStep] = useState<"offer" | "offer-success" | "confirm">(
    retentionOffer.status === "active"
      ? "confirm"
      : retentionOffer.status === "available"
        ? "offer"
        : "confirm",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isPreparing, startPreparing] = useTransition();
  const [acceptedMessage, setAcceptedMessage] = useState("");
  const effectiveOfferStatus = acceptedMessage ? "active" : currentOffer.status;
  const effectiveOfferMessage = acceptedMessage || currentOffer.message || "";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || isPreparing}
        className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          setMessage("");
          setError("");
          startPreparing(async () => {
            const latestOffer = await getRetentionOfferState();
            setCurrentOffer(latestOffer);
            setStep(latestOffer.status === "available" ? "offer" : "confirm");
            setOpen(true);
          });
        }}
      >
        {isPreparing ? <Loader2 className="size-4 animate-spin" /> : null}
        Cancel subscription
      </Button>
      {open ? (
        <ModalShell title="Before you cancel" onClose={() => setOpen(false)}>
          {step === "offer" ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                <div className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Tag className="size-5" />
                  </span>
                  <div>
                    <p className="font-bold text-foreground">
                      Stay with Homzie and get 50% off for 2 months.
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                      Keep your profile, listings and reels live while reducing your
                      next two subscription charges.
                    </p>
                  </div>
                </div>
              </div>
              {message ? (
                <p className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setError("");
                    setMessage("");
                    startTransition(async () => {
                      const result = await applyRetentionDiscount();

                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }

                      const successMessage =
                        result.message || "Your 50% discount has been applied for two months.";
                      setAcceptedMessage(successMessage);
                      setMessage(successMessage);
                      setStep("offer-success");
                      router.refresh();
                    });
                  }}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Tag className="size-4" />
                  )}
                  Accept offer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("confirm")}
                >
                  Continue cancelling
                </Button>
              </div>
            </div>
          ) : step === "offer-success" ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                <div className="flex gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Tag className="size-5" />
                  </span>
                  <div>
                    <p className="font-bold text-foreground">
                      Discount accepted
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                      {message ||
                        effectiveOfferMessage ||
                        "Your 50% discount has been applied for two months."}
                    </p>
                  </div>
                </div>
              </div>
              <p className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                Your billing page now reflects the discounted next charge and the offer cannot be claimed again on this account.
              </p>
              <Button type="button" className="w-full" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-sm font-semibold leading-6 text-muted-foreground">
                  Your subscription will be set to cancel at the end of the current
                  billing period. You can keep using Homzie Agent Pro until then.
                </p>
                {effectiveOfferMessage ? (
                  <p className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground">
                    {effectiveOfferMessage}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {effectiveOfferStatus === "available" ? (
                  <Button type="button" variant="outline" onClick={() => setStep("offer")}>
                    Back to offer
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Keep subscription
                  </Button>
                )}
                <form action={cancelAgentSubscription}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    Confirm cancellation
                  </Button>
                </form>
              </div>
            </div>
          )}
        </ModalShell>
      ) : null}
    </>
  );
}

export function InvoiceHistoryTable({
  invoices,
}: {
  invoices: BillingInvoiceRow[];
}) {
  const pageSize = 5;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(invoices.length / pageSize));
  const visibleInvoices = invoices.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase text-muted-foreground">
              <th className="border-b border-border px-3 py-3">Date</th>
              <th className="border-b border-border px-3 py-3">Description</th>
              <th className="border-b border-border px-3 py-3 text-right">Amount</th>
              <th className="border-b border-border px-3 py-3 text-right">Status</th>
              <th className="border-b border-border px-3 py-3 text-right">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {visibleInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="border-b border-border px-3 py-4 font-medium">
                  {invoice.date}
                </td>
                <td className="border-b border-border px-3 py-4 text-muted-foreground">
                  {invoice.description}
                </td>
                <td className="border-b border-border px-3 py-4 text-right font-medium">
                  {invoice.amount}
                </td>
                <td className="border-b border-border px-3 py-4 text-right">
                  <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold capitalize text-emerald-700">
                    {invoice.status}
                  </span>
                </td>
                <td className="border-b border-border px-3 py-4 text-right">
                  {invoice.downloadUrl ? (
                    <a
                      href={invoice.downloadUrl}
                      className="inline-flex size-8 items-center justify-center rounded-md text-primary hover:bg-secondary"
                      aria-label="Download invoice"
                    >
                      <Download className="size-4" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invoices.length > pageSize ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="font-semibold text-muted-foreground">
            Page {page + 1} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

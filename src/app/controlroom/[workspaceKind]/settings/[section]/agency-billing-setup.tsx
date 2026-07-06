"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { CheckCircle2, LockKeyhole, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  finalizeAgencyBillingSetup,
  startAgencyBillingSetup,
} from "@/modules/agencies/billing-actions";

type AgencyBillingSetupProps = {
  billingConfigured: boolean;
  canManageBilling: boolean;
  paymentMethodLabel: string | null;
};

type BillingSetupIntent = {
  clientSecret: string;
  publishableKey: string;
};

function getStripePaymentMethodId(
  value: string | { id?: string } | null | undefined,
) {
  if (!value) return null;

  return typeof value === "string" ? value : value.id || null;
}

function BillingPaymentForm({
  onDone,
}: {
  onDone: (label: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError("Stripe is still loading. Try again in a moment.");
      return;
    }

    startSubmitting(async () => {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setError(result.error.message || "Your card could not be confirmed.");
        return;
      }

      const finalized = await finalizeAgencyBillingSetup(
        getStripePaymentMethodId(result.setupIntent?.payment_method),
      );

      if (!finalized.ok) {
        setError(finalized.error);
        return;
      }

      onDone(finalized.paymentMethodLabel);
    });
  };

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="rounded-lg border border-border bg-card p-3">
        <PaymentElement
          options={{
            business: {
              name: "Homzie",
            },
            layout: "tabs",
          }}
        />
      </div>
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        className="h-12 w-full text-base"
        disabled={!stripe || !elements || isSubmitting}
      >
        <LockKeyhole className="size-5" />
        {isSubmitting ? "Saving..." : "Save billing method"}
      </Button>
    </form>
  );
}

export function AgencyBillingSetup({
  billingConfigured,
  canManageBilling,
  paymentMethodLabel,
}: AgencyBillingSetupProps) {
  const router = useRouter();
  const [checkout, setCheckout] = useState<BillingSetupIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successLabel, setSuccessLabel] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const publishableKey = checkout?.publishableKey || "";
  const stripePromise = useMemo(() => {
    if (!publishableKey) return null;

    return loadStripe(publishableKey);
  }, [publishableKey]);

  const startSetup = () => {
    setError(null);
    setSuccessLabel(null);

    startTransition(async () => {
      const result = await startAgencyBillingSetup();

      if (!result.ok) {
        setError(
          result.missingEnv?.length
            ? `${result.error} Missing: ${result.missingEnv.join(", ")}.`
            : result.error,
        );
        return;
      }

      setCheckout({
        clientSecret: result.clientSecret,
        publishableKey: result.publishableKey,
      });
    });
  };

  const onDone = (label: string) => {
    setSuccessLabel(label);
    setCheckout(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Payment method
            </p>
            <p className="mt-1 text-sm font-semibold">
              {successLabel ||
                paymentMethodLabel ||
                (billingConfigured ? "Saved" : "Required")}
            </p>
            <p className="mt-2 max-w-2xl text-sm font-normal leading-6 text-muted-foreground">
              Homzie stores a Stripe customer and default payment method for automated agency invoices. No agency subscription is created.
            </p>
          </div>
          {billingConfigured || successLabel ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="size-4" />
              Billing ready
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-700">
              Billing required
            </span>
          )}
        </div>

        <div className="mt-4">
          <Button
            type="button"
            onClick={startSetup}
            disabled={!canManageBilling || isPending}
            className="h-11 font-semibold"
          >
            <LockKeyhole className="size-4" />
            {isPending
              ? "Starting..."
              : billingConfigured
                ? "Update billing method"
                : "Add billing method"}
          </Button>
          {!canManageBilling ? (
            <p className="mt-2 text-xs font-normal text-muted-foreground">
              Ask an owner, admin, or finance employee to update billing.
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {checkout && stripePromise ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg bg-background p-5 shadow-2xl">
            <button
              type="button"
              className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-md border bg-background text-foreground"
              aria-label="Close billing setup"
              onClick={() => setCheckout(null)}
            >
              <X className="size-4" />
            </button>
            <div className="pr-10">
              <p className="text-sm font-semibold text-primary">Agency billing</p>
              <h3 className="mt-2 text-2xl font-bold">Save payment method</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Stripe securely stores the card for automated Homzie agency billing. Charges are created from finalized billing periods, not from a subscription.
              </p>
            </div>
            <div className="mt-6">
              <Elements
                stripe={stripePromise}
                options={{
                  appearance: {
                    theme: "stripe",
                    variables: {
                      borderRadius: "8px",
                      colorPrimary: "#7b5cff",
                      fontFamily: "Poppins, system-ui, sans-serif",
                    },
                  },
                  clientSecret: checkout.clientSecret,
                }}
              >
                <BillingPaymentForm onDone={onDone} />
              </Elements>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

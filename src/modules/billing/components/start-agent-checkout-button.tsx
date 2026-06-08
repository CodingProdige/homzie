"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { BadgeCheck, Check, LockKeyhole, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/modules/currency/currency-provider";
import {
  startAgentSubscriptionCheckout,
  syncAgentSubscriptionStatus,
} from "../actions";
import {
  type AgentPlanInterval,
  agentSubscriptionPlans,
} from "../plans";

type StripeCheckout = {
  clientSecret: string;
  profilePath: string;
  publishableKey: string;
  subscriptionId: string;
};

const planCards: Record<
  AgentPlanInterval,
  {
    title: string;
    description: string;
    badge?: string;
  }
> = {
  month: {
    title: "Monthly",
    description: "Start lean. Pay monthly and cancel anytime.",
  },
  year: {
    title: "Yearly",
    description: "Best for agents building their property brand long-term.",
    badge: "Best value",
  },
};

function StripePaymentForm({
  profilePath,
  selectedPlan,
  subscriptionId,
}: {
  profilePath: string;
  selectedPlan: AgentPlanInterval;
  subscriptionId: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const { formatPriceCents } = useCurrency();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!stripe || !elements) {
      setError("Stripe is still loading. Try again in a moment.");
      return;
    }

    startSubmitting(async () => {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}${profilePath}`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setError(result.error.message || "Your payment could not be confirmed.");
        return;
      }

      const synced = await syncAgentSubscriptionStatus(subscriptionId);

      if (synced.ok && synced.status === "active") {
        window.sessionStorage.setItem(
          "homzie-agent-payment-success",
          subscriptionId,
        );
        window.location.assign(synced.profilePath);
        return;
      }

      window.location.assign(profilePath);
    });
  };

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="rounded-lg border bg-card p-3">
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
        {isSubmitting
          ? "Confirming..."
          : `Subscribe ${formatPriceCents(agentSubscriptionPlans[selectedPlan].amountCents)}${agentSubscriptionPlans[selectedPlan].intervalLabel}`}
      </Button>
    </form>
  );
}

export function StartAgentCheckoutButton() {
  const [selectedPlan, setSelectedPlan] = useState<AgentPlanInterval>("month");
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<StripeCheckout | null>(null);
  const [isPending, startTransition] = useTransition();
  const publishableKey = checkout?.publishableKey || "";
  const { formatPriceCents } = useCurrency();

  const stripePromise = useMemo(() => {
    if (!publishableKey) {
      return null;
    }

    return loadStripe(publishableKey);
  }, [publishableKey]);

  const onStartCheckout = () => {
    setError(null);

    startTransition(async () => {
      const result = await startAgentSubscriptionCheckout(selectedPlan);

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
        profilePath: result.profilePath,
        publishableKey: result.publishableKey,
        subscriptionId: result.subscriptionId,
      });
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["month", "year"] as const).map((interval) => {
          const plan = agentSubscriptionPlans[interval];
          const card = planCards[interval];
          const isSelected = selectedPlan === interval;
          const priceLabel = formatPriceCents(plan.amountCents);

          return (
            <button
              key={interval}
              type="button"
              className={cn(
                "relative min-w-0 rounded-lg border bg-background p-4 text-left transition-[border,box-shadow,transform]",
                isSelected
                  ? "border-primary shadow-lg shadow-primary/10"
                  : "border-border hover:border-primary/50",
              )}
              onClick={() => setSelectedPlan(interval)}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                    {card.title}
                    {card.badge ? (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        {card.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-2 block text-3xl font-bold tracking-tight text-foreground">
                    {priceLabel}
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">
                      {plan.intervalLabel}
                    </span>
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                    {card.description}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border",
                    isSelected
                      ? "border-primary bg-primary text-white"
                      : "border-border text-transparent",
                  )}
                >
                  <Check className="size-3.5" />
                </span>
              </span>
              {interval === "year" ? (
                <span className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <BadgeCheck className="size-3.5" />
                  Save {formatPriceCents(18900)} compared to monthly
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        className="h-14 w-full text-base sm:text-lg"
        disabled={isPending}
        onClick={onStartCheckout}
      >
        <LockKeyhole className="size-5" />
        {isPending
          ? "Starting checkout..."
          : `Start for ${formatPriceCents(agentSubscriptionPlans[selectedPlan].amountCents)}${agentSubscriptionPlans[selectedPlan].intervalLabel}`}
      </Button>
      {error ? (
        <p className="max-w-xl rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {checkout && stripePromise ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg bg-background p-5 shadow-2xl">
            <button
              type="button"
              className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-md border bg-background text-foreground"
              aria-label="Close checkout"
              onClick={() => setCheckout(null)}
            >
              <X className="size-4" />
            </button>
            <div className="pr-10">
              <p className="text-sm font-semibold text-primary">Homzie Agent Plan</p>
              <h3 className="mt-2 text-2xl font-bold">Complete checkout</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Enter your card details securely inside Homzie. Stripe handles the
                payment and subscription billing.
              </p>
            </div>
            <div className="mt-6">
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: checkout.clientSecret,
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
                <StripePaymentForm
                  profilePath={checkout.profilePath}
                  selectedPlan={selectedPlan}
                  subscriptionId={checkout.subscriptionId}
                />
              </Elements>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

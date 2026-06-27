"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
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
import { trackGoogleEvent } from "@/modules/analytics/gtag";
import { useCurrency } from "@/modules/currency/currency-provider";
import {
  finalizeAgentSubscriptionCheckout,
  startAgentSubscriptionCheckout,
} from "../actions";
import {
  getAgentSubscriptionOfferLabel,
  type AgentPlanInterval,
  agentSubscriptionPlans,
} from "../plans";

type StripeCheckout = {
  clientSecret: string;
  profilePath: string;
  publishableKey: string;
  trialApplied: boolean;
};

type CheckoutSuccess = {
  profilePath: string;
  subscriptionId: string;
  trialApplied: boolean;
};

function getStripePaymentMethodId(
  value: string | { id?: string } | null | undefined,
) {
  if (!value) return null;

  return typeof value === "string" ? value : value.id || null;
}

function getPlanCards(trialEligible: boolean): Record<
  AgentPlanInterval,
  {
    title: string;
    description: string;
    badge?: string;
  }
> {
  const offerLabel = getAgentSubscriptionOfferLabel(trialEligible);

  return {
    month: {
      title: "Monthly",
      description: trialEligible
        ? `${offerLabel}, then pay monthly and cancel anytime.`
        : "Subscribe now, pay monthly, and cancel anytime.",
    },
    year: {
      title: "Yearly",
      description: trialEligible
        ? `${offerLabel}, then save long-term on annual billing.`
        : "Subscribe now and save long-term on annual billing.",
      badge: "Best value",
    },
  };
}

function StripePaymentForm({
  profilePath,
  onSuccess,
  selectedPlan,
  trialApplied,
}: {
  profilePath: string;
  onSuccess: (success: CheckoutSuccess) => void;
  selectedPlan: AgentPlanInterval;
  trialApplied: boolean;
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
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}${profilePath}`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setError(result.error.message || "Your card could not be confirmed.");
        return;
      }

      const paymentMethodId = getStripePaymentMethodId(
        result.setupIntent?.payment_method,
      );
      const finalized = await finalizeAgentSubscriptionCheckout(
        selectedPlan,
        paymentMethodId,
      );

      if (finalized.ok && finalized.status === "active") {
        trackGoogleEvent(trialApplied ? "trial_started" : "subscription_started", {
          event_category: "agent_subscription",
          event_label: selectedPlan,
          plan_interval: selectedPlan,
          trial_days: trialApplied ? 7 : 0,
        });
        window.sessionStorage.setItem(
          "homzie-agent-payment-success",
          JSON.stringify({
            subscriptionId: finalized.subscriptionId,
            trialApplied,
          }),
        );
        onSuccess({
          profilePath: finalized.profilePath,
          subscriptionId: finalized.subscriptionId,
          trialApplied,
        });
        return;
      }

      setError(
        finalized.ok
          ? "Your payment method was saved, but your subscription is not active yet. Please contact support."
          : finalized.error,
      );
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
          : trialApplied
            ? `Start ${getAgentSubscriptionOfferLabel(true)}, then ${formatPriceCents(agentSubscriptionPlans[selectedPlan].amountCents)}${agentSubscriptionPlans[selectedPlan].intervalLabel}`
            : `Subscribe now for ${formatPriceCents(agentSubscriptionPlans[selectedPlan].amountCents)}${agentSubscriptionPlans[selectedPlan].intervalLabel}`}
      </Button>
    </form>
  );
}

function CheckoutSuccessPanel({ success }: { success: CheckoutSuccess }) {
  const [secondsRemaining, setSecondsRemaining] = useState(5);

  useEffect(() => {
    const redirectTimer = window.setTimeout(() => {
      window.location.assign(success.profilePath);
    }, 5000);
    const countdownTimer = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(redirectTimer);
      window.clearInterval(countdownTimer);
    };
  }, [success.profilePath]);

  return (
    <div className="rounded-lg border bg-card p-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="size-7" />
      </div>
      <h3 className="mt-4 text-2xl font-bold">
        {success.trialApplied ? "Your agent trial is active" : "Your subscription is active"}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Homzie has confirmed your card and activated your agent tools. You will be
        redirected to your profile in {secondsRemaining} seconds.
      </p>
      <Button
        type="button"
        className="mt-5 h-11"
        onClick={() => window.location.assign(success.profilePath)}
      >
        Open profile now
      </Button>
    </div>
  );
}

export function StartAgentCheckoutButton({
  trialEligible,
}: {
  trialEligible: boolean;
}) {
  const [selectedPlan, setSelectedPlan] = useState<AgentPlanInterval>("month");
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<StripeCheckout | null>(null);
  const [success, setSuccess] = useState<CheckoutSuccess | null>(null);
  const [isPending, startTransition] = useTransition();
  const publishableKey = checkout?.publishableKey || "";
  const { formatPriceCents } = useCurrency();
  const planCards = useMemo(() => getPlanCards(trialEligible), [trialEligible]);

  const stripePromise = useMemo(() => {
    if (!publishableKey) {
      return null;
    }

    return loadStripe(publishableKey);
  }, [publishableKey]);

  const onStartCheckout = () => {
    setError(null);
    setSuccess(null);

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
        trialApplied: result.trialApplied,
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
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
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
          : trialEligible
            ? `Start ${getAgentSubscriptionOfferLabel(true)}`
            : "Subscribe now"}
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
                {checkout.trialApplied
                  ? "Start your 7-day free trial inside Homzie. Stripe securely stores your card and only charges when the trial ends unless you cancel first."
                  : "Complete your subscription inside Homzie. Stripe securely stores your card and starts billing immediately on this account."}
              </p>
            </div>
            <div className="mt-6">
              {success ? (
                <CheckoutSuccessPanel success={success} />
              ) : (
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
                    onSuccess={setSuccess}
                    profilePath={checkout.profilePath}
                    selectedPlan={selectedPlan}
                    trialApplied={checkout.trialApplied}
                  />
                </Elements>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

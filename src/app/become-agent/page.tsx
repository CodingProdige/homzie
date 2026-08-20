import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";
import {
  Check,
  Clapperboard,
  Home,
  LockKeyhole,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { BackButton } from "@/components/back-button";
import { HomzieLogo } from "@/components/homzie-logo";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { getAgencyFundedSeatAccess } from "@/modules/access/agent-access";
import { hasAgentProAccess } from "@/modules/agents/queries";
import { authOptions } from "@/modules/auth/config";
import { StartAgentCheckoutButton } from "@/modules/billing/components/start-agent-checkout-button";
import {
  agentSubscriptionPrice,
  agentSubscriptionTrialLabel,
} from "@/modules/billing/plans";
import { CurrencyAmount } from "@/modules/currency/currency-amount";
import { CurrencySelector } from "@/modules/currency/currency-selector";

const features = [
  {
    icon: Home,
    title: "Publish free, no card",
    description: "Your profile, listings, and property reels are already free to publish.",
  },
  {
    icon: Clapperboard,
    title: "Understand activity",
    description: "Unlock anonymized live activity, listing trends, and AI insights.",
  },
  {
    icon: TrendingUp,
    title: "Connect by choice",
    description: "Respond when an interested buyer starts a conversation with you.",
  },
];

const planBenefits = [
  "Your public agent profile, listings, and property reels remain free to publish whether or not you upgrade.",
  "See anonymized live activity and listing-level trends across listings you own.",
  "Unlock AI listing insights and performance guidance so you know what activity actually means.",
  "Start conversations with buyers who choose to contact you through Homzie.",
  "Access listing activity overview pages and owner-only activity panels.",
  "Stay eligible for future agency-funded seats, branch control room access, and paid visibility features.",
];

export default async function BecomeAgentPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/become-agent");
  }

  const [user] = await db
    .select({
      agentTrialUsedAt: users.agentTrialUsedAt,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username?callbackUrl=/become-agent");
  }

  const [agencyFundedSeat, hasProAccess] = await Promise.all([
    getAgencyFundedSeatAccess(session.user.id),
    hasAgentProAccess(session.user.id),
  ]);

  if (hasProAccess && !agencyFundedSeat) {
    redirect(`/users/${user.username}?agent=active`);
  }

  const [previousSubscription] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  const trialEligible = !user.agentTrialUsedAt && !previousSubscription;

  return (
    <main className="min-h-screen overflow-x-hidden bg-brand-black text-white">
      <section className="relative grid min-h-screen w-full min-w-0 overflow-hidden bg-brand-black text-white lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_92%,rgba(255,159,28,0.95),transparent_20%),radial-gradient(circle_at_78%_72%,rgba(255,77,184,0.75),transparent_28%),radial-gradient(circle_at_12%_88%,rgba(78,42,255,0.5),transparent_34%),linear-gradient(135deg,#040512_0%,#080720_48%,#130827_100%)]" />
        <div className="absolute inset-0 bg-black/15" />

        <div className="fixed left-5 right-5 top-5 z-30 flex items-center justify-between gap-4 sm:left-8 sm:right-8 sm:top-8">
          <BackButton className="rounded-full bg-white/10 px-4 py-2 text-white/85 backdrop-blur-md hover:bg-white/15 hover:text-white" />
          <CurrencySelector className="border-white/15 bg-white/10 text-white backdrop-blur-md" />
        </div>

        <div className="relative z-10 flex min-h-screen min-w-0 flex-col px-5 pb-8 pt-20 sm:px-12 sm:pt-24 lg:px-12 lg:pb-8 xl:px-16">
          <div className="homzie-fade-up mt-12 max-w-xl min-w-0 lg:mt-16">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-pink">
              Homzie Agents
            </p>
            <h1 className="mt-4 max-w-full text-3xl font-bold leading-[1.05] tracking-tight min-[420px]:text-4xl sm:text-5xl lg:text-6xl">
              <span className="block">Upgrade to</span>
              <span className="homzie-gradient-text block">Homzie Pro</span>
              <span className="block">when you need more insight.</span>
            </h1>
            <p className="mt-5 max-w-lg break-words text-sm leading-7 text-white/78 sm:text-base">
              {agencyFundedSeat ? (
                <>
                  Your Agent Pro access is handled through{" "}
                  {agencyFundedSeat.agencyName} as an agency-funded seat.
                </>
              ) : (
                <>
                  Your profile, listings, and reels stay free to publish. {trialEligible
                    ? `Add a card through Stripe to start a ${agentSubscriptionTrialLabel.toLowerCase()}, then pay `
                    : "This optional Pro upgrade starts after Stripe checkout for "}
                  <CurrencyAmount cents={agentSubscriptionPrice.amountCents} />
                  /month for anonymized listing activity, AI insights, and buyer
                  conversations.
                </>
              )}
            </p>
          </div>

          <div className="mt-8 grid min-w-0 gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-0">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="homzie-hover-lift group flex min-w-0 items-center gap-4 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5 lg:block lg:rounded-none lg:border-y-0 lg:border-l-0 lg:border-r lg:bg-transparent lg:px-5 lg:first:pl-0 lg:last:border-r-0"
                >
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-brand-pink shadow-lg shadow-black/10 lg:size-12">
                    <Icon className="size-6" />
                  </div>
                  <div
                    className={`min-w-0 flex-1 ${index > 0 ? "lg:mt-5" : "lg:mt-5"}`}
                  >
                    <p className="break-words text-sm font-bold">{feature.title}</p>
                    <p className="mt-1 max-w-[14rem] break-words text-sm leading-6 text-white/70 lg:text-xs lg:leading-5">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-auto hidden pt-8 lg:block">
            <HomzieLogo className="h-11 brightness-0 invert" priority />
          </div>
        </div>

        <div className="relative z-10 flex min-h-screen min-w-0 items-center px-4 pb-8 sm:px-10 lg:px-10 lg:py-8 xl:px-14">
          <div className="homzie-fade-up homzie-delay-1 w-full min-w-0 overflow-hidden rounded-lg bg-white p-6 text-brand-black shadow-2xl shadow-black/25 sm:p-10 lg:p-8 xl:p-10">
            {agencyFundedSeat ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-primary">
                      Agency-funded seat
                    </p>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight">
                      {agencyFundedSeat.billingReady
                        ? "Your access is covered."
                        : "Agency billing setup required."}
                    </h2>
                    <p className="mt-4 text-sm font-normal leading-6 text-muted-foreground">
                      {agencyFundedSeat.billingReady
                        ? `Your agent access is covered by ${agencyFundedSeat.agencyName}. You do not need a personal Agent Pro subscription.`
                        : `${agencyFundedSeat.agencyName} has linked you as an agency-funded seat, but agency billing must be completed before buyer intent tools unlock.`}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-primary">
                    <Sparkles className="size-3.5" />
                    Agency billing
                  </span>
                </div>

                <div className="mt-8 space-y-4 border-y border-border py-8">
                  {[
                    "No personal Agent Pro subscription is needed while you are linked to this agency-funded seat.",
                    "Agency-funded access is billed through automated agency seat billing, not through your personal billing page.",
                    agencyFundedSeat.billingReady
                      ? "Buyer intent tools are available while the agency billing profile remains ready."
                      : "Buyer intent tools unlock once the agency owner saves billing information.",
                  ].map((benefit) => (
                    <p key={benefit} className="flex gap-3 text-sm leading-6">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary text-primary">
                        <Check className="size-3.5" />
                      </span>
                      <span>{benefit}</span>
                    </p>
                  ))}
                </div>

                <div className="mt-8 grid gap-3">
                  {agencyFundedSeat.canManageAgencyBilling ? (
                    <Button asChild className="h-11">
                      <Link href={agencyFundedSeat.controlRoomBillingHref}>
                        {agencyFundedSeat.billingReady
                          ? "Open agency billing"
                          : "Set up agency billing"}
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" className="h-11">
                    <Link href={`/users/${user.username}`}>Back to profile</Link>
                  </Button>
                  {!agencyFundedSeat.canManageAgencyBilling &&
                  !agencyFundedSeat.billingReady ? (
                    <p className="text-center text-xs font-medium text-muted-foreground">
                      Ask an agency billing manager to complete billing setup.
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-primary">Optional Homzie Pro upgrade</p>
                    <p className="mt-2 text-sm font-normal text-muted-foreground">
                      {trialEligible
                        ? `A card is required for the ${agentSubscriptionTrialLabel.toLowerCase()} on monthly and yearly plans.`
                        : "A card is required. Monthly and yearly plans start billing immediately on this account."}
                    </p>
                    <div className="mt-4 flex items-end gap-2">
                      <span className="text-5xl font-bold tracking-tight sm:text-6xl">
                        <CurrencyAmount cents={agentSubscriptionPrice.amountCents} />
                      </span>
                      <span className="pb-2 text-base font-medium text-muted-foreground">
                        /month
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-primary">
                      <Sparkles className="size-3.5" />
                    Buyer intent tools
                  </span>
                </div>

                <div className="mt-8 space-y-4 border-b border-border pb-8">
                  {planBenefits.map((benefit) => (
                    <p key={benefit} className="flex gap-3 text-sm leading-6">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary text-primary">
                        <Check className="size-3.5" />
                      </span>
                      <span>{benefit}</span>
                    </p>
                  ))}
                </div>

                <div className="mt-8">
                  <StartAgentCheckoutButton trialEligible={trialEligible} />
                  <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                    <LockKeyhole className="size-4" />
                    {trialEligible
                      ? `Card required. ${agentSubscriptionTrialLabel}. Cancel anytime before your first charge.`
                      : "Your next subscription will start immediately after checkout."}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

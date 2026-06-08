import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
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
import { db } from "@/db";
import { users } from "@/db/schema";
import { hasActiveAgentSubscription } from "@/modules/agents/queries";
import { authOptions } from "@/modules/auth/config";
import { StartAgentCheckoutButton } from "@/modules/billing/components/start-agent-checkout-button";
import { agentSubscriptionPrice } from "@/modules/billing/plans";
import { CurrencyAmount } from "@/modules/currency/currency-amount";
import { CurrencySelector } from "@/modules/currency/currency-selector";

const features = [
  {
    icon: Home,
    title: "Publish listings",
    description: "Showcase properties that get attention.",
  },
  {
    icon: Clapperboard,
    title: "Post property reels",
    description: "Create content that builds trust and reach.",
  },
  {
    icon: TrendingUp,
    title: "Boost visibility",
    description: "Get discovered by more buyers and renters.",
  },
];

const planBenefits = [
  "Public agent profile with your name, handle, bio, location, stats, listings, reels, and saved trust signals.",
  "Publish active property listings and keep them linked to your profile for buyers and renters to browse.",
  "Upload property reels and link each video to a listing so viewers can move from discovery to enquiry.",
  "Receive leads and viewing booking requests from interested users once those flows are enabled.",
  "Access agent dashboard tools for profile editing, listing management, video management, and performance insights.",
  "Eligible for future boosts and paid visibility features without changing your account type again.",
];

export default async function BecomeAgentPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const hasSubscription = await hasActiveAgentSubscription(session.user.id);

  if (hasSubscription) {
    redirect(`/users/${user.username}?agent=active`);
  }

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
          <div className="mt-12 max-w-xl min-w-0 lg:mt-16">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-pink">
              Homzie Agents
            </p>
            <h1 className="mt-4 max-w-full text-3xl font-bold leading-[1.05] tracking-tight min-[420px]:text-4xl sm:text-5xl lg:text-6xl">
              <span className="block">Turn your profile</span>
              <span className="block">into a</span>
              <span className="homzie-gradient-text block">
                property agent
              </span>{" "}
              <span className="block">portfolio.</span>
            </h1>
            <p className="mt-5 max-w-lg break-words text-sm leading-7 text-white/78 sm:text-base">
              Agents pay{" "}
              <CurrencyAmount cents={agentSubscriptionPrice.amountCents} />
              /month to publish
              listings, post reels, link videos to properties, capture leads,
              and build visibility on Homzie.
            </p>
          </div>

          <div className="mt-8 grid min-w-0 gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-0">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group flex min-w-0 items-center gap-4 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5 lg:block lg:rounded-none lg:border-y-0 lg:border-l-0 lg:border-r lg:bg-transparent lg:px-5 lg:first:pl-0 lg:last:border-r-0"
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
          <div className="w-full min-w-0 overflow-hidden rounded-lg bg-white p-6 text-brand-black shadow-2xl shadow-black/25 sm:p-10 lg:p-8 xl:p-10">
            <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-primary">Agent plan</p>
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
                    Agent tools
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
                  <StartAgentCheckoutButton />
                  <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                    <LockKeyhole className="size-4" />
                    Cancel anytime. No long-term contracts.
                  </p>
                </div>
            </>
          </div>
        </div>
      </section>
    </main>
  );
}

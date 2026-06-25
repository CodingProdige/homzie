import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Crown,
  Eye,
  LockKeyhole,
  MessageCircle,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import {
  agentSubscriptionPrice,
  agentSubscriptionTrialLabel,
} from "@/modules/billing/plans";
import { CurrencyAmount } from "@/modules/currency/currency-amount";
import {
  AgentPricingViewedTracker,
  AgentTrialLink,
} from "@/app/for-agents/agent-landing-tracking";

export const metadata: Metadata = {
  title: "Go Pro | See Buyer Intent Live",
  description:
    "Listings, reels, and agent profiles are free on Homzie. Go Pro to unlock live buyer activity, buyer intent, AI insights, and chat opportunities.",
};

const checkoutPath = "/become-agent";

function checkoutHref(isSignedIn: boolean) {
  return isSignedIn
    ? checkoutPath
    : `/register?callbackUrl=${encodeURIComponent(checkoutPath)}`;
}

function TrialButton({
  href,
  location,
  variant = "default",
  className,
  children = "Start 7-day free trial",
}: {
  href: string;
  location: string;
  variant?: "default" | "outline";
  className?: string;
  children?: string;
}) {
  return (
    <Button asChild className={className} size="lg" variant={variant}>
      <AgentTrialLink href={href} location={`go_pro_${location}`}>
        {children}
        <ArrowRight className="size-4" />
      </AgentTrialLink>
    </Button>
  );
}

const freeFeatures = [
  "Public agent profile",
  "Publish listings",
  "Post property reels",
  "Basic listing management",
  "Public discovery on Homzie",
];

const proFeatures = [
  "Live buyer activity",
  "Active viewer panels",
  "Buyer activity timelines",
  "AI buyer and listing insights",
  "Chat with interested buyers",
  "Listing buyer activity overview",
];

const proUnlocks = [
  {
    icon: Eye,
    title: "See active buyers",
    text: "Know which signed-in buyers are viewing your listings and who keeps returning.",
  },
  {
    icon: BarChart3,
    title: "Understand intent",
    text: "Read timelines that show views, saves, likes, photo browsing, bond calculator usage, and offer starts.",
  },
  {
    icon: MessageCircle,
    title: "Act while interest is hot",
    text: "Start the right conversation while the buyer is active instead of waiting for a cold enquiry.",
  },
  {
    icon: Sparkles,
    title: "Use AI insight",
    text: "Get plain-language summaries of buyer behaviour and listing performance so you know what to improve.",
  },
];

const comparisonRows = [
  ["Agent profile", true, true],
  ["Listings and reels", true, true],
  ["Basic listing management", true, true],
  ["Live buyer activity", false, true],
  ["Buyer timelines", false, true],
  ["AI intent insights", false, true],
  ["Chat from buyer intent surfaces", false, true],
] as const;

const agencyRows = [
  {
    icon: Building2,
    title: "Independent agencies",
    text: "Pay for linked agent seats, control local branding, invite paid agents, and manage your own workspace.",
  },
  {
    icon: UsersRound,
    title: "Branch agencies",
    text: "Link to a Network HQ for brand relationship and branch visibility while keeping branch billing self-funded.",
  },
  {
    icon: Crown,
    title: "Network HQs",
    text: "Review branch affiliation requests, enforce brand rules, compare branch performance, and roll up analytics.",
  },
];

function CheckMark({ active }: { active: boolean }) {
  if (!active) {
    return <span className="text-sm font-black text-muted-foreground">-</span>;
  }

  return (
    <span className="inline-grid size-6 place-items-center rounded-full bg-primary/10 text-primary">
      <Check className="size-4" />
    </span>
  );
}

function BuyerIntentMockup() {
  const rows = [
    ["Sarah Parker", "High", "2m ago"],
    ["James M.", "High", "5m ago"],
    ["Lindiwe N.", "Low", "18m ago"],
  ];

  return (
    <div className="rounded-lg border border-white/35 bg-white/80 p-4 shadow-xl shadow-primary/10 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">
            Buyer activity
          </p>
          <p className="mt-1 text-2xl font-black">5 active viewers</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
          Live
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background">
        {rows.map(([name, intent, time]) => (
          <div
            key={name}
            className="grid grid-cols-[1fr_auto] gap-3 border-b border-border p-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{name}</p>
              <p className="truncate text-xs font-semibold text-muted-foreground">
                {intent} intent
              </p>
            </div>
            <p className="self-center text-xs font-black text-muted-foreground">
              {time}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-primary/15 bg-primary/5 p-3">
        <p className="text-sm font-black">AI insight</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
          You have returning buyers on your strongest listing. Follow up while
          activity is live.
        </p>
      </div>
    </div>
  );
}

export default async function GoProPage() {
  const session = await getServerSession(authOptions);
  const viewer = await getViewerChrome(session?.user?.id);
  const href = checkoutHref(Boolean(session?.user?.id));

  return (
    <>
      <GlobalHeader
        viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />

      <main className="overflow-x-hidden bg-background text-foreground">
        <section className="relative border-b border-border">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_16%,rgba(255,77,184,0.18),transparent_28%),radial-gradient(circle_at_48%_12%,rgba(123,92,255,0.16),transparent_26%)]" />
          <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 pb-14 pt-28 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:pb-20 lg:pt-32">
            <div className="homzie-fade-up flex flex-col justify-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">
                Upgrade your demand layer
              </p>
              <h1 className="mt-4 text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
                Go Pro. See Buyer Intent Live.
              </h1>
              <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-muted-foreground sm:text-lg">
                Listings, reels, and your agent profile are free. Homzie Pro
                unlocks the buyer demand layer: active buyers, listing activity,
                buyer timelines, AI insights, and chat opportunities.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <TrialButton
                  href={href}
                  location="hero"
                  className="h-12 px-6 text-sm font-black sm:h-14"
                />
                <TrialButton
                  href="#plans"
                  location="compare"
                  variant="outline"
                  className="h-12 px-6 text-sm font-black sm:h-14"
                >
                  Compare plans
                </TrialButton>
              </div>
              <p className="mt-4 text-xs font-bold text-muted-foreground">
                Card required. You are only charged after the 7-day trial unless
                you cancel first.
              </p>
            </div>

            <div className="homzie-fade-up homzie-delay-1 relative">
              <div className="homzie-hover-lift rounded-lg border border-border bg-card p-4 shadow-2xl shadow-primary/10 sm:p-6">
                <div className="grid gap-4 lg:grid-cols-[0.82fr_1fr]">
                  <div className="rounded-lg bg-[linear-gradient(135deg,rgba(123,92,255,0.14),rgba(255,77,184,0.12))] p-5">
                    <span className="grid size-14 place-items-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                      <Radar className="size-7" />
                    </span>
                    <h2 className="mt-8 text-2xl font-black leading-tight">
                      Unlock buyer-intent tools that drive real action.
                    </h2>
                    <div className="mt-6 grid gap-3">
                      {[
                        "See who is actively interested",
                        "Message buyers in real time",
                        "Win more deals faster",
                      ].map((item) => (
                        <p
                          key={item}
                          className="flex items-center gap-2 text-sm font-black"
                        >
                          <CheckCircle2 className="size-4 text-primary" />
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                  <BuyerIntentMockup />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="plans"
          className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
        >
          <AgentPricingViewedTracker />
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="homzie-hover-lift rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-black text-muted-foreground">Free</p>
              <h2 className="mt-3 text-4xl font-black">R0</h2>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Everything you need to start building your public property brand.
              </p>
              <div className="mt-6 grid gap-3">
                {freeFeatures.map((feature) => (
                  <p key={feature} className="flex items-center gap-3 text-sm font-black">
                    <CheckCircle2 className="size-5 text-primary" />
                    {feature}
                  </p>
                ))}
              </div>
            </article>

            <article className="homzie-hover-lift relative overflow-hidden rounded-lg border border-primary bg-card p-6 shadow-xl shadow-primary/10">
              <span className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground">
                Most popular
              </span>
              <p className="text-sm font-black text-primary">Pro</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <h2 className="text-4xl font-black">
                  <CurrencyAmount cents={agentSubscriptionPrice.amountCents} />
                </h2>
                <p className="pb-1 text-sm font-black text-muted-foreground">
                  / month
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Unlock the demand tools that turn listing attention into
                conversations.
              </p>
              <div className="mt-6 grid gap-3">
                {proFeatures.map((feature) => (
                  <p key={feature} className="flex items-center gap-3 text-sm font-black">
                    <CheckCircle2 className="size-5 text-primary" />
                    {feature}
                  </p>
                ))}
              </div>
              <TrialButton
                href={href}
                location="pricing_card"
                className="mt-7 w-full"
              />
              <p className="mt-3 text-center text-xs font-bold text-muted-foreground">
                {agentSubscriptionTrialLabel}. Cancel before your first charge.
              </p>
            </article>
          </div>

          <div className="homzie-fade-up homzie-delay-2 mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr] border-b border-border bg-muted/35 p-4 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              <span>All features</span>
              <span className="text-center">Free</span>
              <span className="text-center">Pro</span>
            </div>
            {comparisonRows.map(([label, free, pro]) => (
              <div
                key={label}
                className="grid grid-cols-[1.5fr_0.7fr_0.7fr] items-center border-b border-border p-4 last:border-b-0"
              >
                <p className="text-sm font-semibold">{label}</p>
                <span className="text-center">
                  <CheckMark active={free} />
                </span>
                <span className="text-center">
                  <CheckMark active={pro} />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-muted/35">
          <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                What Pro unlocks
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                Free gets you visible. Pro shows you demand.
              </h2>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {proUnlocks.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    className="homzie-hover-lift rounded-lg border border-border bg-card p-5 shadow-sm"
                  >
                    <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-black">{item.title}</h3>
                    <p className="mt-3 text-sm font-semibold leading-7 text-muted-foreground">
                      {item.text}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
              Control rooms
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Agency teams get a different operating model.
            </h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-muted-foreground sm:text-base">
              Individual agents can subscribe to Pro directly. Agencies can pay
              for linked agent seats from the control room, manage branding, and
              keep billing where the business expects it.
            </p>
            <div className="homzie-hover-lift mt-6 rounded-lg border border-border bg-card p-5">
              <p className="flex items-start gap-3 text-sm font-black leading-6">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                Network HQs do not pay for branch seats. Each agency or branch
                remains responsible for its own agent billing.
              </p>
            </div>
          </div>
          <div className="grid content-start gap-3">
            {agencyRows.map((row) => {
              const Icon = row.icon;

              return (
                <article
                  key={row.title}
                  className="homzie-hover-lift rounded-lg border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-black">{row.title}</h3>
                      <p className="mt-2 text-sm font-semibold leading-7 text-muted-foreground">
                        {row.text}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-border bg-brand-black text-white">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
                Built around proof
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                More than impressions.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Publish for free", "Build the habit first."],
                ["Prove traffic", "Let movement create urgency."],
                ["Unlock demand", "Convert interest into action."],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="homzie-hover-lift rounded-lg border border-white/10 bg-white/[0.06] p-5"
                >
                  <Target className="size-5 text-brand-pink" />
                  <p className="mt-4 text-lg font-black">{title}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/68">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
            Quick answers
          </p>
          <div className="mt-6 divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
            {[
              [
                "Can I create listings without Pro?",
                "Yes. Listings, reels, and your public agent profile are free. Pro unlocks buyer intent and performance visibility.",
              ],
              [
                "What happens if my agency pays for me?",
                "Your individual billing is locked while you are linked as an agency-funded agent seat. The agency manages seat billing in the control room.",
              ],
              [
                "Do agencies and Network HQs use the same billing?",
                "No. Agencies and branches pay for their own linked agent seats. Network HQs manage brand and branch oversight, not branch seat billing.",
              ],
              [
                "Is this replacing the broader for-agents page?",
                "No. The for-agents page explains the Homzie agent story. This page is specifically for upgrading to Pro.",
              ],
            ].map(([question, answer]) => (
              <details key={question} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-black">
                  {question}
                  <BadgeCheck className="size-4 shrink-0 text-primary transition-transform group-open:rotate-12" />
                </summary>
                <p className="mt-3 text-sm font-semibold leading-7 text-muted-foreground">
                  {answer}
                </p>
              </details>
            ))}
          </div>

          <div className="homzie-hover-lift mt-8 rounded-lg border border-border bg-card p-6 text-center shadow-xl shadow-primary/5">
            <LockKeyhole className="mx-auto size-6 text-primary" />
            <h2 className="mt-4 text-2xl font-black">Ready to see buyer intent?</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
              Start with a 7-day trial, publish freely, and unlock the buyer
              signals that make follow-up feel obvious.
            </p>
            <TrialButton
              href={href}
              location="final"
              className="mt-6 w-full sm:w-fit"
            />
          </div>
        </section>
      </main>

      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </>
  );
}

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clapperboard,
  Eye,
  MessageCircle,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
} from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import {
  AgentPricingViewedTracker,
  AgentTrialLink,
  AgentWalkthroughVideo,
} from "./agent-landing-tracking";

export const metadata: Metadata = {
  title: "Win More Mandates With Homzie | Agent Trial",
  description:
    "Start a 7-day Homzie agent trial. Build your agent profile, publish listings and reels, see live buyer intent, and prove your marketing to sellers.",
};

const trialCallbackUrl = "/become-agent";

function trialHref(isSignedIn: boolean) {
  return isSignedIn
    ? trialCallbackUrl
    : `/register?callbackUrl=${encodeURIComponent(trialCallbackUrl)}`;
}

const valueCards = [
  {
    icon: UserRoundCheck,
    title: "Prove your marketing",
    text: "Show sellers a public agent profile with your listings, reels, sold activity, and buyer engagement proof in one place.",
  },
  {
    icon: Radar,
    title: "Know who is serious",
    text: "See active viewers, returning buyers, listing activity, direct offers, and buyer intent signals instead of guessing from basic view counts.",
  },
  {
    icon: MessageCircle,
    title: "Act while interest is hot",
    text: "Start a chat while a buyer is viewing your listing, follow up with returning buyers, and respond before interest goes cold.",
  },
];

const featureBlocks = [
  {
    icon: UserRoundCheck,
    title: "Agent profile",
    text: "Build a public profile that shows sellers who you are, where you operate, your listings, reels, and performance proof.",
  },
  {
    icon: Clapperboard,
    title: "Property reels",
    text: "Create short-form property content that gives your listings more life than a static portal card.",
  },
  {
    icon: Eye,
    title: "Realtime buyer activity",
    text: "See who is actively viewing your listings, who came back, and which listings are getting serious attention.",
  },
  {
    icon: BarChart3,
    title: "Buyer intent insights",
    text: "Understand what buyer actions suggest: browsing, returning, saving, calculating bond payments, starting offers, or engaging with photos.",
  },
  {
    icon: TrendingUp,
    title: "Direct offers",
    text: "Let buyers show intent directly through offer starts and listing actions instead of waiting for a cold enquiry.",
  },
  {
    icon: MessageCircle,
    title: "Built-in chat",
    text: "Move from interest to conversation without jumping between portals, WhatsApp screenshots, and scattered follow-ups.",
  },
];

const comparisonRows = [
  {
    old: "Wait for buyers to enquire.",
    new: "See buyer activity and act while interest is live.",
  },
  {
    old: "Listings sit under the agency brand.",
    new: "Build your own proof-of-work agent profile.",
  },
  {
    old: "Views are vague and easy to overread.",
    new: "Buyer intent shows who returned, acted, offered, or engaged.",
  },
];

const trialBullets = [
  "7 days free",
  "Payment method required to activate trial",
  "Cancel before the trial ends",
  "Built for estate agents and agencies",
];

function TrialButton({
  className,
  href,
  location,
  variant = "default",
}: {
  className?: string;
  href: string;
  location: string;
  variant?: "default" | "outline";
}) {
  return (
    <Button asChild className={className} size="lg" variant={variant}>
      <AgentTrialLink href={href} location={location}>
        Start 7-day free trial
        <ArrowRight className="size-4" />
      </AgentTrialLink>
    </Button>
  );
}

export default async function ForAgentsPage() {
  const session = await getServerSession(authOptions);
  const viewer = await getViewerChrome(session?.user?.id);
  const href = trialHref(Boolean(session?.user?.id));

  return (
    <>
      <GlobalHeader
        viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />

      <main className="overflow-x-hidden bg-background text-foreground">
        <section className="relative min-h-[92svh] overflow-hidden bg-brand-black text-white">
          <video
            className="absolute inset-0 size-full object-cover opacity-70"
            src="/video/sign-in-video.mp4"
            autoPlay
            muted
            playsInline
            preload="metadata"
          />
          <div className="absolute inset-0 bg-black/62" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />

          <div className="relative z-10 mx-auto flex min-h-[92svh] w-full max-w-7xl flex-col justify-end px-4 pb-20 pt-28 sm:px-6 lg:px-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-white/75">
              Homzie for estate agents
            </p>
            <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              Win More Mandates. See Buyer Intent Live.
            </h1>
            <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-white/82 sm:text-lg">
              Homzie helps estate agents prove their marketing, publish modern
              listings and reels, track real buyer activity, and chat with
              serious buyers while interest is hot.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <TrialButton
                className="h-12 px-6 text-sm font-black sm:h-14 sm:px-8"
                href={href}
                location="hero"
              />
              <p className="text-sm font-semibold text-white/72">
                Set up your profile, add your first listing, and activate your trial.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-3 px-4 pt-8 sm:px-6 lg:grid-cols-3 lg:px-8">
          {valueCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.title}
                className="rounded-lg border border-border bg-card p-5 shadow-xl shadow-primary/5"
              >
                <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-5 text-xl font-black">{card.title}</h2>
                <p className="mt-3 text-sm font-semibold leading-7 text-muted-foreground">
                  {card.text}
                </p>
              </article>
            );
          })}
        </section>

        <section
          id="demo"
          className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                See Homzie in action
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                Watch how agents turn listings into proof.
              </h2>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-muted-foreground sm:text-base">
                See how an agent can build a profile, publish listings and reels,
                monitor live buyer activity, and use buyer intent to follow up smarter.
              </p>
            </div>
            <TrialButton
              className="w-full sm:w-fit"
              href={href}
              location="demo_header"
            />
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-border bg-brand-black shadow-2xl shadow-primary/10">
            <AgentWalkthroughVideo
              className="aspect-video w-full bg-brand-black object-contain"
            />
          </div>
        </section>

        <section className="border-y border-border bg-muted/35">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                Agent growth tools
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                Everything an agent needs to market with proof.
              </h2>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featureBlocks.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="rounded-lg border border-border bg-card p-5 shadow-sm"
                  >
                    <Icon className="size-5 text-primary" />
                    <h3 className="mt-4 text-lg font-black">{feature.title}</h3>
                    <p className="mt-3 text-sm font-semibold leading-7 text-muted-foreground">
                      {feature.text}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="mt-8">
              <TrialButton href={href} location="features" />
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              Seller mandate proof
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Walk into seller meetings with proof.
            </h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-muted-foreground sm:text-base">
              Most agents tell sellers they will market harder. Homzie helps you
              show it. Your profile, reels, listings, buyer activity, and
              performance signals become proof that you understand buyer behaviour
              and can act on interest faster.
            </p>
            <div className="mt-8">
              <TrialButton href={href} location="mandate_proof" />
            </div>
          </div>

          <div className="grid content-start gap-3">
            {[
              "Show your active marketing presence.",
              "Show listing engagement and buyer activity.",
              "Show sellers how you follow up on real intent.",
              "Differentiate from agents relying only on property portals.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                <p className="text-sm font-black leading-6">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-muted/35">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              Not just another portal
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
              Stop waiting for cold enquiries.
            </h2>

            <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              {comparisonRows.map((row, index) => (
                <div
                  key={row.old}
                  className="grid gap-4 border-b border-border p-5 last:border-b-0 lg:grid-cols-2"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                      Traditional portals
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                      {row.old}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-primary">
                      Homzie
                    </p>
                    <p className="mt-2 text-sm font-black leading-6">
                      {row.new}
                    </p>
                  </div>
                  <span className="sr-only">Comparison row {index + 1}</span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <TrialButton href={href} location="comparison" />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <AgentPricingViewedTracker />
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xl shadow-primary/5">
            <div className="grid gap-0 lg:grid-cols-[1fr_0.85fr]">
              <div className="p-6 sm:p-8 lg:p-10">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                  Start your agent trial
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                  Start your 7-day agent trial.
                </h2>
                <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground sm:text-base">
                  Create your profile, publish your first listing, test reels, and
                  see how Homzie helps you prove your value to sellers.
                </p>
                <div className="mt-8">
                  <TrialButton href={href} location="trial_section" />
                </div>
              </div>

              <div className="border-t border-border bg-muted/35 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
                <div className="grid gap-3">
                  {trialBullets.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <ShieldCheck className="size-5 shrink-0 text-primary" />
                      <p className="text-sm font-black">{item}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-xs font-semibold leading-6 text-muted-foreground">
                  Trial activation uses Homzie&apos;s existing agent subscription
                  checkout. Your card is stored securely by Stripe and you can
                  manage billing from your account settings.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
            Questions agents ask
          </p>
          <div className="mt-6 divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
            {[
              [
                "Do I need an agency account?",
                "No. Individual agents can start with their own profile. Agencies and Network HQs can later manage teams, branches, billing, and listing controls through the control room.",
              ],
              [
                "Why do you need payment details for a free trial?",
                "To activate the subscription automatically after the trial unless you cancel. You can cancel before the trial ends.",
              ],
              [
                "Can I use Homzie if my agency controls listings?",
                "Yes. You can still build your profile and reels, and agency-controlled listing workflows are being built for teams that need approval and oversight.",
              ],
              [
                "Is this replacing Property24?",
                "No. Homzie is designed to give agents and agencies buyer intent, profile proof, reels, chat, and performance visibility that traditional portals do not provide.",
              ],
            ].map(([question, answer]) => (
              <details key={question} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-black">
                  {question}
                  <Sparkles className="size-4 shrink-0 text-primary transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm font-semibold leading-7 text-muted-foreground">
                  {answer}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-8 text-center">
            <TrialButton
              className="mx-auto"
              href={href}
              location="faq_final"
            />
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}

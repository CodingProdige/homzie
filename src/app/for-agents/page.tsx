import type { Metadata } from "next";
import Link from "next/link";
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
import { activateFreeAgentProfile } from "@/modules/agents/free-agent-profile-actions";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import {
  AgentWalkthroughVideo,
} from "./agent-landing-tracking";

export const metadata: Metadata = {
  title: "List Free, Build Your Audience | Homzie for Agents",
  description:
    "Build a public real estate agent profile, publish listings and property reels for free, then upgrade to Homzie Pro when you need advanced buyer-intent tools.",
};

const freeProfileCallbackUrl = "/for-agents";

function freeProfileHref() {
  return `/register?callbackUrl=${encodeURIComponent(freeProfileCallbackUrl)}`;
}

const valueCards = [
  {
    icon: UserRoundCheck,
    title: "Build your following",
    text: "Keep your profile, listings, reels, and track record attached to you—not buried under a portal or agency logo.",
  },
  {
    icon: Radar,
    title: "Understand demand safely",
    text: "Use anonymous activity patterns, saves, views, and contact signals to understand where interest is growing.",
  },
  {
    icon: MessageCircle,
    title: "Connect when buyers choose",
    text: "Let buyers start the conversation through messages and enquiries, with the listing context already attached.",
  },
];

const featureBlocks = [
  {
    icon: UserRoundCheck,
    title: "Agent profile",
    text: "Build a public profile that shows who you are, where you work, and the listings and reels that represent your work.",
  },
  {
    icon: Clapperboard,
    title: "Property reels",
    text: "Create short-form property content that gives your listings more life than a static portal card.",
  },
  {
    icon: Eye,
    title: "Buyer activity trends",
    text: "Understand active views, returning interest, saves, and listing engagement without exposing passive buyer identities.",
  },
  {
    icon: BarChart3,
    title: "Buyer interest insights",
    text: "See which actions signal momentum: returning, saving, engaging with media, messaging, and sharing interest.",
  },
  {
    icon: TrendingUp,
    title: "Interest conversations",
    text: "Give buyers a clear way to ask questions, send interest, and start a direct conversation about a listing.",
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
    new: "See anonymous activity trends and respond when a buyer chooses to engage.",
  },
  {
    old: "Listings sit under the agency brand.",
    new: "Build your own proof-of-work agent profile.",
  },
  {
    old: "Views are vague and easy to overread.",
    new: "Buyer interest shows how listings are performing without treating passive browsing as a lead.",
  },
];

const freeProfileBullets = [
  "Free public agent profile",
  "Publish listings and property reels",
  "No payment details required",
  "Upgrade to Pro only when you want advanced tools",
];

function FreeProfileButton({
  className,
  isSignedIn,
  variant = "default",
}: {
  className?: string;
  isSignedIn: boolean;
  variant?: "default" | "outline";
}) {
  const label = "Create free agent profile";

  if (isSignedIn) {
    return (
      <form action={activateFreeAgentProfile}>
        <Button className={className} size="lg" type="submit" variant={variant}>
          {label}
          <ArrowRight className="size-4" />
        </Button>
      </form>
    );
  }

  return (
    <Button asChild className={className} size="lg" variant={variant}>
      <Link href={freeProfileHref()}>
        {label}
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  );
}

export default async function ForAgentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const viewer = await getViewerChrome(session?.user?.id);
  const isSignedIn = Boolean(session?.user?.id);
  const query = searchParams ? await searchParams : {};
  const notice = query.notice;

  return (
    <>
      <GlobalHeader
        viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace}
        viewerRole={viewer.role}
        viewerAvatarUrl={viewer.avatarUrl}
        viewerName={viewer.name}
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

          <div className="homzie-fade-up relative z-10 mx-auto flex min-h-[92svh] w-full max-w-7xl flex-col justify-end px-4 pb-20 pt-28 sm:px-6 lg:px-8">
            {notice === "profile-suspended" ? (
              <p className="mb-5 max-w-2xl rounded-lg border border-amber-300/45 bg-amber-100/15 px-4 py-3 text-sm font-semibold text-amber-50">
                Your agent profile is currently under review. Please contact Homzie support if you need help.
              </p>
            ) : null}
            {notice === "agency-profile" ? (
              <p className="mb-5 max-w-2xl rounded-lg border border-sky-200/35 bg-sky-100/10 px-4 py-3 text-sm font-semibold text-sky-50">
                Your agency role is already active. Manage your team and listings from the control room.
              </p>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
              Homzie for real estate agents
            </p>
            <h1 className="mt-5 max-w-5xl text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              Your listings shouldn&apos;t disappear into a portal.
            </h1>
            <p className="mt-6 max-w-3xl text-base font-semibold leading-8 text-white/82 sm:text-lg">
              Build an audience around your properties, create reels that travel,
              and turn every listing into proof of your work. Start with a free
              public agent profile—no card required.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <FreeProfileButton
                className="h-12 px-6 text-sm font-semibold sm:h-14 sm:px-8"
                isSignedIn={isSignedIn}
              />
              <p className="text-sm font-semibold text-white/72">
                Set up your profile, add your first listing, and publish at your pace.
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
                className="homzie-hover-lift rounded-lg border border-border bg-card p-5 shadow-xl shadow-primary/5"
              >
                <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-5 text-xl font-semibold">{card.title}</h2>
                <p className="mt-3 text-sm font-normal leading-7 text-muted-foreground">
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                See Homzie in action
              </p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
                Watch how agents turn listings into proof.
              </h2>
              <p className="mt-4 max-w-3xl text-sm font-normal leading-7 text-muted-foreground sm:text-base">
                See how an agent can build a profile, publish listings and reels,
                understand listing momentum, and turn chosen buyer contact into
                stronger conversations.
              </p>
            </div>
            <FreeProfileButton
              className="w-full sm:w-fit"
              isSignedIn={isSignedIn}
            />
          </div>

          <div className="homzie-fade-up homzie-delay-1 mt-8 overflow-hidden rounded-lg border border-border bg-brand-black shadow-2xl shadow-primary/10">
            <AgentWalkthroughVideo
              className="aspect-video w-full bg-brand-black object-contain"
            />
          </div>
        </section>

        <section className="border-y border-border bg-muted/35">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Agent growth tools
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                Everything an agent needs to market with proof.
              </h2>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featureBlocks.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="homzie-hover-lift rounded-lg border border-border bg-card p-5 shadow-sm"
                  >
                    <Icon className="size-5 text-primary" />
                    <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-3 text-sm font-normal leading-7 text-muted-foreground">
                      {feature.text}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="mt-8">
              <FreeProfileButton isSignedIn={isSignedIn} />
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              More proof, less portal dependence
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              Make every listing part of your public portfolio.
            </h2>
            <p className="mt-4 text-sm font-normal leading-7 text-muted-foreground sm:text-base">
              Your profile, reels, listings, and performance stay connected to you.
              Show prospective sellers how you present homes and build a visible
              body of work over time.
            </p>
            <div className="mt-8">
              <FreeProfileButton isSignedIn={isSignedIn} />
            </div>
          </div>

          <div className="grid content-start gap-3">
            {[
              "Show your active marketing presence.",
              "Show listing engagement and interest trends.",
              "Show buyers a clear way to start a conversation.",
              "Differentiate from agents relying only on property portals.",
            ].map((item) => (
              <div
                key={item}
                className="homzie-hover-lift flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                <p className="text-sm font-semibold leading-6">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-muted/35">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Not just another portal
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Don&apos;t just upload a listing. Build a following around it.
            </h2>

            <div className="homzie-fade-up homzie-delay-1 mt-8 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              {comparisonRows.map((row, index) => (
                <div
                  key={row.old}
                  className="grid gap-4 border-b border-border p-5 last:border-b-0 lg:grid-cols-2"
                >
                  <div>
                    <p className="text-[10px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
                      Traditional portals
                    </p>
                    <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                      {row.old}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                      Homzie
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6">
                      {row.new}
                    </p>
                  </div>
                  <span className="sr-only">Comparison row {index + 1}</span>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <FreeProfileButton isSignedIn={isSignedIn} />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="homzie-hover-lift overflow-hidden rounded-lg border border-border bg-card shadow-xl shadow-primary/5">
            <div className="grid gap-0 lg:grid-cols-[1fr_0.85fr]">
              <div className="p-6 sm:p-8 lg:p-10">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Start free
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                  Build your public property brand first.
                </h2>
                <p className="mt-4 max-w-2xl text-sm font-normal leading-7 text-muted-foreground sm:text-base">
                  Create your profile, publish your first listing, and test property
                  reels without entering payment details. Homzie Pro remains there
                  when you need advanced buyer-interest tools.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <FreeProfileButton isSignedIn={isSignedIn} />
                  <Button asChild size="lg" variant="outline">
                    <Link href="/go-pro">Explore Homzie Pro</Link>
                  </Button>
                </div>
              </div>

              <div className="border-t border-border bg-muted/35 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
                <div className="grid gap-3">
                  {freeProfileBullets.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <ShieldCheck className="size-5 shrink-0 text-primary" />
                      <p className="text-sm font-semibold">{item}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-xs font-normal leading-6 text-muted-foreground">
                  Free publishing does not create a Stripe subscription. Pro is a
                  separate, optional upgrade that you can manage from your account.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Questions agents ask
          </p>
          <div className="mt-6 divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
            {[
              [
                "Do I need an agency account?",
                "No. Individual agents can start with their own profile. Agencies and Network HQs can later manage teams, branches, billing, and listing controls through the control room.",
              ],
              [
                "Do I need a card to create an agent profile or list?",
                "No. Your public agent profile, listings, and property reels are free to create and publish. Payment details are only needed if you choose the optional Homzie Pro upgrade.",
              ],
              [
                "Can I use Homzie if my agency controls listings?",
                "Yes. You can still build your profile and reels, and agency-controlled listing workflows are being built for teams that need approval and oversight.",
              ],
              [
                "Is this just another property portal?",
                "No. Homzie is built around people as well as properties: agent profiles, property reels, public portfolios, buyer conversations, and respectful activity signals.",
              ],
            ].map(([question, answer]) => (
              <details key={question} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
                  {question}
                  <Sparkles className="size-4 shrink-0 text-primary transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm font-normal leading-7 text-muted-foreground">
                  {answer}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-8 text-center">
            <FreeProfileButton
              className="mx-auto"
              isSignedIn={isSignedIn}
            />
          </div>
        </section>
      </main>

      <GlobalFooter />
    </>
  );
}

import type { Metadata } from "next";
import { connection } from "next/server";
import { Heart, Play, ShieldCheck, UsersRound } from "lucide-react";

import {
  Eyebrow,
  GradientWord,
  missionImage,
  PrimaryLink,
  PublicPageShell,
  publicHeroImage,
  RoundedImage,
  SecondaryLink,
  teamImage,
} from "@/modules/public-pages/page-shell";
import { CurrencyAmount } from "@/modules/currency/currency-amount";
import { getPlatformStats } from "@/modules/platform-stats/actions";

export const metadata: Metadata = {
  title: "About Homzie",
  description: "Learn how Homzie is building an agent-first property discovery platform.",
};

const values = [
  {
    icon: ShieldCheck,
    title: "Proof Over Promises",
    text: "Agents build public portfolios where listings, reels and results speak for themselves.",
  },
  {
    icon: UsersRound,
    title: "Agent First",
    text: "Homzie is designed around the people doing the real work of winning trust and selling homes.",
  },
  {
    icon: Play,
    title: "Reels For Property",
    text: "Discovery should feel alive. Reels make homes easier to explore, share and remember.",
  },
  {
    icon: Heart,
    title: "Fair Access",
    text: "Powerful property marketing should not cost thousands before an agent gets a real shot.",
  },
];

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString("en-ZA");
}

export default async function AboutPage() {
  await connection();

  const platformStats = await getPlatformStats();
  const stats = [
    {
      label: "Active listings",
      value: formatCount(platformStats.totalListings),
    },
    {
      label: "Property reels",
      value: formatCount(platformStats.totalReels),
    },
    {
      label: "Total sold value",
      value: (
        <CurrencyAmount cents={platformStats.totalSoldValueCents} compact />
      ),
    },
    {
      label: "Happy users",
      value: formatCount(platformStats.totalUsers),
    },
    {
      label: "Top agents",
      value: formatCount(platformStats.totalAgents),
    },
  ];

  return (
    <PublicPageShell>
      <section className="page-body py-8 sm:py-14 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.04fr] lg:items-center lg:gap-16">
          <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
            <Eyebrow>About Homzie</Eyebrow>
            <h1 className="mt-4 text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Real estate built around <GradientWord>the agents who sell.</GradientWord>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm font-semibold leading-7 text-muted-foreground lg:mx-0 lg:text-base">
              Homzie shifts property discovery away from agency logos and back
              to the people buyers and sellers actually trust: the agents. It is
              a lead generation and portfolio platform where performance,
              personality and proof can do the talking.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <PrimaryLink href="/listings">Explore properties</PrimaryLink>
            </div>
          </div>
          <div className="relative aspect-[1.24] overflow-hidden rounded-lg">
            <RoundedImage alt="Modern luxury Homzie property" src={publicHeroImage} />
          </div>
        </div>

        <div className="mt-10 grid divide-y divide-border border-y border-border sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="py-5 text-center">
              <p className="text-xl font-black text-primary">{stat.value}</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-body grid gap-8 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:py-14">
        <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
          <Eyebrow>Our Story</Eyebrow>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            Built to stop making agents pay for permission.
          </h2>
          <div className="mt-5 space-y-4 text-sm font-semibold leading-7 text-muted-foreground">
            <p>
              Real estate marketing has revolved around big portals and agency
              budgets for too long. Agents often have to pay heavily just to list
              a single property, while the platform benefits more from their hard
              work than they do.
            </p>
            <p>
              Homzie was built to flip that model. For roughly the price of two
              coffees a month, agents can build a living portfolio, publish
              listings, create property reels, and show sellers why they are the
              right person to trust with the next mandate.
            </p>
            <p>
              Buyers get a fresher way to discover homes. Sellers get a clearer
              view of an agent&apos;s work. Agents get a platform where their track
              record, content and consistency can help generate better leads and
              more future listings.
            </p>
          </div>
          <div className="mt-7">
            <SecondaryLink href="/about#mission">Our mission</SecondaryLink>
          </div>
        </div>
        <div className="relative aspect-[1.32] overflow-hidden rounded-lg">
          <RoundedImage alt="Homzie team discussing property strategy" src={teamImage} />
        </div>
      </section>

      <section className="page-body py-10 lg:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Our Values</Eyebrow>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            The principles behind an agent-first platform.
          </h2>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => {
            const Icon = value.icon;
            return (
              <article
                key={value.title}
                className="rounded-lg border border-border bg-card p-6 text-center shadow-sm"
              >
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-6" />
                </span>
                <h3 className="mt-5 text-sm font-black">{value.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-muted-foreground">
                  {value.text}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="mission" className="page-body py-8 lg:py-14">
        <div className="grid overflow-hidden rounded-lg bg-primary/8 lg:grid-cols-[0.9fr_1fr]">
          <div className="p-7 sm:p-10">
            <Eyebrow>Our Mission</Eyebrow>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Help great agents become impossible to ignore.
            </h2>
            <p className="mt-5 max-w-xl text-sm font-semibold leading-7 text-muted-foreground">
              Our mission is to give agents affordable, modern tools to win
              attention, build proof, and turn their work into opportunity. With
              listings, reels and performance-led profiles in one place, Homzie
              helps agents show sellers exactly what they bring to the table.
            </p>
            <div className="mt-7">
              <SecondaryLink href="/contact">Learn more</SecondaryLink>
            </div>
          </div>
          <div className="relative min-h-56">
            <RoundedImage alt="Warm modern living room" src={missionImage} />
          </div>
        </div>
      </section>

      <section className="page-body py-10 text-center lg:py-16">
        <Eyebrow>Let&apos;s Connect</Eyebrow>
        <h2 className="mt-3 text-3xl font-black">Ready to change the game?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-muted-foreground">
          Whether you are an agent building your portfolio or a buyer discovering
          your next home, we would love to hear from you.
        </p>
        <div className="mt-6">
          <PrimaryLink href="/contact">Contact us</PrimaryLink>
        </div>
      </section>
    </PublicPageShell>
  );
}

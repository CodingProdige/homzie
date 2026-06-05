import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "About Homzie",
  description: "Learn how Homzie is reimagining real estate discovery.",
};

const stats = [
  ["1,245+", "Active listings"],
  ["320+", "Property reels"],
  ["243M+", "Total sold value"],
  ["8,560+", "Happy users"],
  ["300+", "Top agents"],
];

const values = [
  {
    icon: ShieldCheck,
    title: "Trust & Transparency",
    text: "Honest listings, verified agents and clearer information.",
  },
  {
    icon: UsersRound,
    title: "People First",
    text: "Users sit at the center of every product decision we make.",
  },
  {
    icon: Play,
    title: "Innovation",
    text: "Smarter, faster and more visual property experiences.",
  },
  {
    icon: Heart,
    title: "Community",
    text: "A real estate community built around confidence and proof.",
  },
];

export default function AboutPage() {
  return (
    <PublicPageShell>
      <section className="page-body py-8 sm:py-14 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.04fr] lg:items-center lg:gap-16">
          <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
            <Eyebrow>About Homzie</Eyebrow>
            <h1 className="mt-4 text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Reimagining real estate for <GradientWord>the way you live.</GradientWord>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm font-semibold leading-7 text-muted-foreground lg:mx-0 lg:text-base">
              Homzie is more than a property platform. It is a movement to make
              real estate more transparent, more personal, and more connected.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <PrimaryLink href="/listings">Explore properties</PrimaryLink>
              <SecondaryLink href="/agents">Meet our team</SecondaryLink>
            </div>
          </div>
          <div className="relative aspect-[1.24] overflow-hidden rounded-lg">
            <RoundedImage alt="Modern luxury Homzie property" src={publicHeroImage} />
          </div>
        </div>

        <div className="mt-10 grid divide-y divide-border border-y border-border sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          {stats.map(([value, label]) => (
            <div key={label} className="py-5 text-center">
              <p className="text-xl font-black text-primary">{value}</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-body grid gap-8 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:py-14">
        <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
          <Eyebrow>Our Story</Eyebrow>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            Built by people who understand property.
          </h2>
          <div className="mt-5 space-y-4 text-sm font-semibold leading-7 text-muted-foreground">
            <p>
              Homzie was founded with a simple belief: finding or selling property
              should be exciting, not exhausting.
            </p>
            <p>
              We saw a real estate experience that was outdated, fragmented and
              difficult to navigate. So we set out to build something better.
            </p>
            <p>
              Today, Homzie connects buyers, sellers and agents through property
              reels, intelligent search and verified listings.
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
            The principles that drive everything we do.
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
              Empower people to find, love and live in the right property.
            </h2>
            <p className="mt-5 max-w-xl text-sm font-semibold leading-7 text-muted-foreground">
              Whether you are buying your first home, selling an investment or
              just exploring your options, we are here to guide you every step of
              the way.
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
        <h2 className="mt-3 text-3xl font-black">We&apos;re here to help.</h2>
        <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-muted-foreground">
          Have questions or feedback? We would love to hear from you.
        </p>
        <div className="mt-6">
          <PrimaryLink href="/contact">Contact us</PrimaryLink>
        </div>
      </section>
    </PublicPageShell>
  );
}

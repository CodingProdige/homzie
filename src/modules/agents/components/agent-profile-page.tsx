"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bath,
  BedDouble,
  Bookmark,
  Check,
  Clapperboard,
  Heart,
  Home,
  Menu,
  MoreHorizontal,
  Play,
  Search,
  Share2,
  Star,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CurrencySelector } from "@/modules/currency/currency-selector";
import { useCurrency } from "@/modules/currency/currency-provider";
import { RichCaption } from "@/modules/reels/components/rich-caption";
import { agentProfile, type AgentListing, type AgentReel } from "../data/mock-agent-profile";

const navItems = ["Buy", "Rent", "Developments", "Commercial", "Agents", "Reels"];

function BrandHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur-xl">
      <div className="flex h-20 w-full items-center justify-between px-3">
        <Link href="/" className="flex items-center gap-3" aria-label="Homzie home">
          <Image
            src="/logo/homzie-logo-dark-tight.png"
            alt="Homzie"
            width={1099}
            height={310}
            className="h-8 w-auto object-contain sm:h-9 lg:h-10"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-10 text-sm font-semibold text-foreground lg:flex">
          {navItems.map((item) => (
            <Link
              key={item}
              href={item === "Agents" ? "/agents" : "#"}
              className="flex items-center gap-2 transition-colors hover:text-primary"
            >
              {item}
              {item === "Reels" ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                  New
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <CurrencySelector className="hidden sm:inline-flex" />
          <Button variant="ghost" size="icon" aria-label="Saved properties">
            <Heart className="size-5" />
          </Button>
          <Button className="hidden px-6 sm:inline-flex">
            Sign in
          </Button>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="size-6" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full [background:var(--homzie-gradient)] text-white shadow-lg shadow-primary/25",
        className,
      )}
    >
      <Check className="size-3.5 stroke-[3]" />
    </span>
  );
}

function ProfileAvatar() {
  return (
    <div className="relative shrink-0">
      <div className="rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] p-1">
        <Image
          src={agentProfile.avatarUrl}
          alt={agentProfile.name}
          width={168}
          height={168}
          className="size-32 rounded-full border-4 border-background object-cover sm:size-40"
          priority
          unoptimized
        />
      </div>
      <VerifiedBadge className="absolute bottom-2 right-1 sm:bottom-3" />
    </div>
  );
}

function ProfileHero() {
  return (
    <section className="page-container grid gap-8 py-10 lg:grid-cols-[230px_1fr_auto] lg:items-start lg:py-16">
      <ProfileAvatar />

      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {agentProfile.name}
          </h1>
          <VerifiedBadge />
        </div>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          @{agentProfile.username} · {agentProfile.location}
        </p>

        <div className="mt-6 flex gap-10">
          {agentProfile.stats.map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-7 space-y-1 text-sm leading-6">
          <p className="font-bold">{agentProfile.title}</p>
          {agentProfile.bio.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <Link href="#" className="inline-block pt-2 font-semibold text-primary">
            {agentProfile.link}
          </Link>
        </div>

        <div className="mt-7 grid max-w-xl grid-cols-[1fr_1fr_auto] gap-3">
          <Button>
            Follow
          </Button>
          <Button variant="outline">Message</Button>
          <Button variant="outline" size="icon" aria-label="Add agent">
            <UserPlus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="hidden items-center gap-2 lg:flex">
        <Button variant="ghost" size="icon" aria-label="Share profile">
          <Share2 className="size-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="More profile actions">
          <MoreHorizontal className="size-6" />
        </Button>
      </div>
    </section>
  );
}

function Highlights() {
  return (
    <section className="page-container overflow-x-auto pb-8">
      <div className="flex min-w-max gap-8">
        {agentProfile.highlights.map((highlight) => (
          <div key={highlight.title} className="w-24 text-center">
            <Image
              src={highlight.imageUrl}
              alt={highlight.title}
              width={88}
              height={88}
              className="mx-auto size-20 rounded-full border-2 border-background object-cover shadow-md ring-1 ring-border"
              unoptimized
            />
            <p className="mt-3 text-xs font-semibold">{highlight.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfileTabs() {
  const tabs = [
    { label: "Reels", icon: Clapperboard, active: true },
    { label: "Listings", icon: Home },
    { label: "Saved", icon: Bookmark },
  ];

  return (
    <div className="border-y border-border">
      <div className="page-container grid grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.label}
              className={cn(
                "flex h-14 items-center justify-center gap-2 border-b-2 text-sm font-semibold transition-colors",
                tab.active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              type="button"
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReelCard({ reel }: { reel: AgentReel }) {
  const href = reel.listingId
    ? `/properties/${reel.listingId}`
    : `/users/${agentProfile.username}`;

  return (
    <Link
      href={href}
      className="group relative isolate aspect-[4/5] overflow-hidden rounded-lg bg-brand-midnight shadow-sm"
    >
      <Image
        src={reel.imageUrl}
        alt={reel.title}
        fill
        sizes="(max-width: 768px) 33vw, 25vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        unoptimized
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
      <div className="absolute left-4 right-4 top-4 text-sm font-semibold leading-5 text-white sm:text-base">
        <RichCaption text={reel.title} />
      </div>
      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-sm font-semibold text-white">
        <Play className="size-4 fill-white" />
        {reel.views}
      </div>
      {reel.listingId ? (
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase text-brand-electric opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          Listing
        </span>
      ) : null}
    </Link>
  );
}

function ReelsGrid() {
  return (
    <section className="page-container py-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {agentProfile.reels.map((reel) => (
          <ReelCard key={reel.id} reel={reel} />
        ))}
      </div>
    </section>
  );
}

function ListingCard({ listing }: { listing: AgentListing }) {
  const { formatPriceLabel } = useCurrency();

  return (
    <Card className="overflow-hidden rounded-lg py-0 shadow-md shadow-black/5">
      <div className="relative aspect-[4/2.7] overflow-hidden">
        <Image
          src={listing.imageUrl}
          alt={listing.title}
          fill
          sizes="(max-width: 768px) 85vw, 25vw"
          className="object-cover"
          unoptimized
        />
        <span className="absolute left-4 top-4 rounded-full [background:var(--homzie-gradient)] px-3 py-1 text-xs font-bold text-white">
          {listing.label}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-lg font-bold text-primary">
            {formatPriceLabel(listing.price)}
          </p>
          <h3 className="mt-1 text-sm font-bold">{listing.title}</h3>
          <p className="mt-2 text-xs text-muted-foreground">{listing.location}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BedDouble className="size-4" />
            {listing.bedrooms}
          </span>
          <span className="flex items-center gap-1">
            <Bath className="size-4" />
            {listing.bathrooms}
          </span>
          <span className="flex items-center gap-1">
            <Home className="size-4" />
            {listing.garages}
          </span>
        </div>
      </div>
    </Card>
  );
}

function ListedProperties() {
  return (
    <section className="page-container py-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">Listed Properties</h2>
        <Link href="#" className="text-sm font-semibold text-primary">
          See all
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {agentProfile.listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="page-container pb-24 pt-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">What clients say</h2>
        <Link href="#" className="text-sm font-semibold text-primary">
          See all
        </Link>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {agentProfile.testimonials.map((testimonial) => (
          <Card key={testimonial.author} className="rounded-lg p-6 shadow-md shadow-black/5">
            <p className="min-h-24 text-sm leading-6">{testimonial.quote}</p>
            <div className="mt-5 flex gap-1 text-primary">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="size-4 fill-current" />
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Image
                src={testimonial.imageUrl}
                alt={testimonial.author}
                width={40}
                height={40}
                className="size-10 rounded-full object-cover"
                unoptimized
              />
              <div>
                <p className="text-sm font-bold">{testimonial.author}</p>
                <p className="text-xs text-muted-foreground">{testimonial.location}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function MobileBottomNav() {
  const items = [
    { label: "Home", icon: Home, active: true },
    { label: "Search", icon: Search },
    { label: "Reels", icon: Clapperboard },
    { label: "Saved", icon: Heart },
    { label: "Profile", icon: UserPlus },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-2 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className={cn(
                "flex flex-col items-center gap-1 rounded-md py-1 text-[11px] font-semibold",
                item.active ? "text-primary" : "text-foreground",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function AgentPlatformBanner() {
  return (
    <section className="page-container py-6">
      <div className="grid gap-4 rounded-lg border bg-brand-black p-5 text-white shadow-xl shadow-primary/10 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-sm font-semibold text-brand-pink">Agent creator platform</p>
          <h2 className="mt-1 text-xl font-bold">Publish listings, post reels, and link every video to a property.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
            Agents subscribe from {agentProfile.subscriptionPrice} to manage their profile, upload listings,
            publish reels, capture leads, book viewings, and boost visibility.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/reels/new">Upload Reel</Link>
          </Button>
          <Button variant="secondary">Add Listing</Button>
        </div>
      </div>
    </section>
  );
}

export function AgentProfilePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BrandHeader />
      <main className="page-body">
        <ProfileHero />
        <AgentPlatformBanner />
        <Highlights />
        <ProfileTabs />
        <ReelsGrid />
        <ListedProperties />
        <Testimonials />
      </main>
      <MobileBottomNav />
    </div>
  );
}

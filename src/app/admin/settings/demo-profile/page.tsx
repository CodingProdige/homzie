import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import {
  AdminDemoProfileSettingsForm,
  type AdminDemoProfileSettingsView,
} from "@/app/admin/admin-demo-profile-settings-form";
import { toggleAdminDemoSubscriptionAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { sql } from "@/db";

export const metadata: Metadata = {
  title: "Demo Profile Settings | Homzie Admin",
  description: "Manage the Homzie demo agent profile and showcase data.",
};

const demoEmail = "demo.agent@homzie.co.za";
const defaultPassword = "HomzieDemo2026!";

type DemoProfileRow = {
  bio: string | null;
  contact_email: string | null;
  email: string;
  headline: string | null;
  location: string | null;
  name: string;
  profile_visible: boolean;
  username: string | null;
};

type DemoSubscriptionRow = {
  current_period_end: string | null;
  status: string;
};

type DemoListingRow = {
  asking_price_cents: number | null;
  details: Record<string, unknown> | null;
  features: string[] | null;
  location: string | null;
  sold_at: string | null;
  sold_price_cents: number | null;
  status: string;
  title: string;
};

const defaultListings = [
  {
    askingPriceCents: 1895000000,
    bathrooms: 5,
    bedrooms: 6,
    buyerIncentive: "Private buyer shortlist",
    daysOnMarket: 21,
    erfSize: 1260,
    features: ["Ocean views", "Cinema room", "Wine cellar", "Solar backup"],
    floorSize: 620,
    garages: 4,
    location: "Clifton, Cape Town",
    parking: 6,
    soldAt: "2026-05-22T10:30:00.000Z",
    soldPriceCents: 1870000000,
    status: "sold",
    title: "Clifton glass villa with panoramic Atlantic views",
  },
  {
    askingPriceCents: 1290000000,
    bathrooms: 4,
    bedrooms: 5,
    buyerIncentive: "Private viewing list",
    daysOnMarket: 0,
    erfSize: 870,
    features: ["Beach access", "Rooftop deck", "Smart home", "Double-volume living"],
    floorSize: 455,
    garages: 3,
    location: "Camps Bay, Cape Town",
    parking: 5,
    status: "published",
    title: "Camps Bay beach house with elevated entertainment deck",
  },
];

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function soldDate(value: string | null) {
  return value ? new Date(value).toISOString() : undefined;
}

async function getDemoProfileSettings(): Promise<AdminDemoProfileSettingsView> {
  const [profile] = await sql<DemoProfileRow[]>`
    SELECT
      u.name,
      u.username,
      u.email,
      u.bio,
      u.location,
      u.contact_email,
      u.profile_visible,
      ap.headline
    FROM users u
    LEFT JOIN agent_profiles ap ON ap.user_id = u.id
    WHERE u.email = ${demoEmail}
      AND u.is_demo = true
    LIMIT 1
  `;

  const listings = profile
    ? await sql<DemoListingRow[]>`
        SELECT
          title,
          location,
          asking_price_cents,
          sold_price_cents,
          status,
          sold_at,
          details,
          features
        FROM property_listings
        WHERE user_id = (
          SELECT id
          FROM users
          WHERE email = ${demoEmail}
            AND is_demo = true
          LIMIT 1
        )
          AND is_demo_content = true
        ORDER BY
          CASE status WHEN 'sold' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
          sold_at DESC NULLS LAST,
          created_at DESC
      `
    : [];

  const listingsJson = JSON.stringify(
    listings.length
      ? listings.map((listing) => {
          const details = listing.details || {};

          return {
            askingPriceCents: listing.asking_price_cents || 0,
            bathrooms: numberValue(details.bathrooms),
            bedrooms: numberValue(details.bedrooms),
            buyerIncentive: stringValue(details.buyerIncentive),
            daysOnMarket: 14,
            erfSize: numberValue(details.erfSize),
            features: Array.isArray(listing.features) ? listing.features : [],
            floorSize: numberValue(details.floorSize),
            garages: numberValue(details.garages),
            location: listing.location || "",
            parking: numberValue(details.parking),
            soldAt: soldDate(listing.sold_at),
            soldPriceCents: listing.sold_price_cents || undefined,
            status: listing.status === "sold" ? "sold" : "published",
            title: listing.title,
          };
        })
      : defaultListings,
    null,
    2,
  );

  return {
    bio:
      profile?.bio ||
      "Luxury coastal specialist. This demo profile shows agents how Homzie can turn verified sales history, active listings, and profile analytics into a high-trust public portfolio.",
    contactEmail: profile?.contact_email || demoEmail,
    email: profile?.email || demoEmail,
    headline: profile?.headline || "Top-performing luxury coastal specialist",
    listingsJson,
    location: profile?.location || "Cape Town, Western Cape",
    name: profile?.name || "Ava Morgan",
    username: profile?.username || "avamorgandemo",
    visible: profile?.profile_visible ?? true,
  };
}

async function getDemoSubscription() {
  const [subscription] = await sql<DemoSubscriptionRow[]>`
    SELECT status, current_period_end
    FROM subscriptions
    WHERE provider_reference = 'demo:homzie-agent-pro'
    LIMIT 1
  `;
  const currentPeriodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const subscribed =
    subscription?.status === "active" &&
    Boolean(currentPeriodEnd && currentPeriodEnd > new Date());

  return {
    currentPeriodEnd,
    status: subscription?.status || "missing",
    subscribed,
  };
}

export default async function AdminDemoProfileSettingsPage() {
  const [settings, subscription] = await Promise.all([
    getDemoProfileSettings(),
    getDemoSubscription(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <Button variant="ghost" asChild className="-ml-3 mb-6">
        <Link href="/admin/settings">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Demo Profile
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
            Edit the mock agent profile, login credentials, active showcase
            listings, and sold-history data used by the public performance page.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/users/${settings.username}`}>
              Open profile
              <ExternalLink className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/users/${settings.username}/performance`}>
              Open analytics
              <ExternalLink className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-primary">
              Demo access state
            </p>
            <h2 className="mt-2 text-xl font-black">
              {subscription.subscribed ? "Subscribed" : "Unsubscribed"}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
              This controls whether the demo profile passes the same Pro access
              checks used by listing creation, reel creation, and subscriber-only
              profile features.
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Status: {subscription.status}
              {subscription.currentPeriodEnd
                ? ` · Access ends ${subscription.currentPeriodEnd.toLocaleDateString("en-ZA")}`
                : ""}
            </p>
          </div>
          <form action={toggleAdminDemoSubscriptionAction}>
            <input
              type="hidden"
              name="subscribed"
              value={subscription.subscribed ? "false" : "true"}
            />
            <Button
              type="submit"
              variant={subscription.subscribed ? "outline" : "default"}
            >
              {subscription.subscribed
                ? "Switch to unsubscribed"
                : "Switch to subscribed"}
            </Button>
          </form>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
        <AdminDemoProfileSettingsForm
          credentials={{
            defaultPassword,
            email: settings.email,
          }}
          settings={settings}
        />
      </section>
    </main>
  );
}

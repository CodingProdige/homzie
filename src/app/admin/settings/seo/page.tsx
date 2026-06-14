import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, SearchCheck } from "lucide-react";

import { sql } from "@/db";
import {
  AdminSeoSettingsForm,
  type AdminSeoSettingsView,
} from "@/app/admin/admin-seo-settings-form";
import { Button } from "@/components/ui/button";
import { getStoredSeoSettings } from "@/modules/seo/settings";

export const metadata: Metadata = {
  title: "SEO Settings | Homzie Admin",
  description: "Manage Homzie SEO settings, search indexing and metadata defaults.",
};

type ListingSeoRow = {
  asking_price_cents: number | null;
  details: Record<string, unknown> | null;
  id: string;
  listing_type: string;
  location: string | null;
  media: unknown;
  property_type: string;
  status: string;
  title: string;
};

type ProfileSeoRow = {
  avatar_url: string | null;
  bio: string | null;
  id: string;
  is_demo: boolean;
  location: string | null;
  name: string;
  username: string | null;
};

type SeoHealthItem = {
  id: string;
  issues: string[];
  label: string;
  type: "listing" | "profile";
};

type SeoIssueSummary = {
  count: number;
  issue: string;
  type: "Listings" | "Profiles";
};

function detailsObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasMedia(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function listingIssues(row: ListingSeoRow) {
  const details = detailsObject(row.details);
  const issues: string[] = [];

  if (!hasMedia(row.media)) issues.push("Needs photos");
  if (!row.location && !details.city && !details.suburb) issues.push("Missing location");
  if (!row.asking_price_cents) issues.push("Missing price");
  if (row.title.length < 18) issues.push("Thin title");

  return issues;
}

function profileIssues(row: ProfileSeoRow) {
  const issues: string[] = [];

  if (!row.avatar_url) issues.push("Missing avatar");
  if (!row.bio || row.bio.length < 80) issues.push("Thin bio");
  if (!row.location) issues.push("Missing location");
  if (row.is_demo) issues.push("Demo profile");

  return issues;
}

function summarizeHealthIssues(items: SeoHealthItem[]) {
  const issueCounts = new Map<string, SeoIssueSummary>();

  items.forEach((item) => {
    item.issues.forEach((issue) => {
      const type = item.type === "listing" ? "Listings" : "Profiles";
      const key = `${type}:${issue}`;
      const current = issueCounts.get(key);

      issueCounts.set(key, {
        count: (current?.count || 0) + 1,
        issue,
        type,
      });
    });
  });

  return Array.from(issueCounts.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.type !== b.type) return a.type.localeCompare(b.type);

    return a.issue.localeCompare(b.issue);
  });
}

async function getSeoPageData() {
  const [settings, listingRows, profileRows] = await Promise.all([
    getStoredSeoSettings(),
    sql<ListingSeoRow[]>`
      SELECT
        id,
        asking_price_cents,
        details,
        listing_type,
        location,
        media,
        property_type,
        status,
        title
      FROM property_listings
      WHERE status = 'published'
      ORDER BY updated_at DESC
    `,
    sql<ProfileSeoRow[]>`
      SELECT
        id,
        avatar_url,
        bio,
        is_demo,
        location,
        name,
        username
      FROM users
      WHERE status = 'active'
        AND profile_visible = true
        AND username IS NOT NULL
      ORDER BY updated_at DESC
    `,
  ]);
  const listings = listingRows.map((row) => ({
    id: row.id,
    issues: listingIssues(row),
    label: row.title,
    type: "listing" as const,
  }));
  const profiles = profileRows.map((row) => ({
    id: row.id,
    issues: profileIssues(row),
    label: `${row.name}${row.username ? ` (@${row.username})` : ""}`,
    type: "profile" as const,
  }));

  return {
    issueSummary: summarizeHealthIssues([...listings, ...profiles]),
    listings,
    profiles,
    settings: settings satisfies AdminSeoSettingsView,
  };
}

function HealthCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  const Icon = warning ? AlertTriangle : CheckCircle2;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-primary">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

export default async function AdminSeoSettingsPage() {
  const { issueSummary, listings, profiles, settings } = await getSeoPageData();
  const listingIssueCount = listings.reduce(
    (total, listing) => total + listing.issues.length,
    0,
  );
  const profileIssueCount = profiles.reduce(
    (total, profile) => total + profile.issues.length,
    0,
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <Button asChild variant="ghost" className="mb-6 px-0">
        <Link href="/admin/settings">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
      </Button>

      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <SearchCheck className="size-6" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Admin
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            SEO
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-muted-foreground">
            Manage metadata defaults, verification tags, indexing policy, and quick
            search-quality checks for public Homzie pages.
          </p>
        </div>
      </div>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <HealthCard label="Indexing" value={settings.allowIndexing ? "On" : "Off"} warning={!settings.allowIndexing} />
        <HealthCard label="Listings checked" value={listings.length} />
        <HealthCard label="Listing issues" value={listingIssueCount} warning={listingIssueCount > 0} />
        <HealthCard label="Profile issues" value={profileIssueCount} warning={profileIssueCount > 0} />
      </section>

      <div className="mt-8 space-y-8">
        <AdminSeoSettingsForm settings={settings} />

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black">SEO health notes</h2>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
              {issueSummary.length} issue groups
            </p>
          </div>
          {issueSummary.length ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-muted/60 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Issue</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {issueSummary.map((item) => (
                    <tr key={`${item.type}-${item.issue}`}>
                      <td className="px-4 py-3 font-black">{item.issue}</td>
                      <td className="px-4 py-3 font-semibold text-muted-foreground">
                        {item.type}
                      </td>
                      <td className="px-4 py-3 text-right text-lg font-black">
                        {item.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-5 text-sm font-bold text-muted-foreground">
              No SEO health issues found for public listings or profiles.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

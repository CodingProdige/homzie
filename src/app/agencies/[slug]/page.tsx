import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  ExternalLink,
  Home,
  ListChecks,
  Network,
  UsersRound,
} from "lucide-react";

import { AgentProfileAvatar } from "@/components/agent-profile-avatar";
import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import {
  getPublicAgencyProfile,
  type PublicAgencyBrand,
  publicAgencyTypeLabel,
  type PublicAgencyAgent,
  type PublicAgencyProfile,
} from "@/modules/agencies/public-directory";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";

type AgencyProfilePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type StatCardProps = {
  helper: string;
  icon: typeof Building2;
  label: string;
  value: number;
};

function StatCard({ helper, icon: Icon, label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-sm font-normal leading-5 text-muted-foreground">
        {helper}
      </p>
    </div>
  );
}

function AgencyHeroBanner({
  brand,
  networkLabel,
}: {
  brand: PublicAgencyBrand;
  networkLabel: string;
}) {
  const badgeStyle = brand.badgeStyle;
  const hasLogo = Boolean(brand.logoUrl);

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-border shadow-sm"
      style={{
        backgroundColor: badgeStyle.backgroundColor,
        color: badgeStyle.textColor,
        fontFamily: badgeStyle.fontFamily,
        fontWeight: Number(badgeStyle.fontWeight),
      }}
    >
      <div className="relative aspect-[2.8/1] min-h-32 sm:aspect-[4.5/1] lg:aspect-[6/1]">
        {hasLogo ? (
          <Image
            src={brand.logoUrl || ""}
            alt={`${brand.name} brand banner`}
            fill
            priority
            sizes="(min-width: 1280px) 1180px, calc(100vw - 2rem)"
            className="object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center px-6 text-center">
            <span className="max-w-4xl truncate text-4xl font-black leading-none tracking-normal sm:text-6xl">
              {brand.badgeLabel || brand.name}
            </span>
          </div>
        )}
      </div>
      <span className="absolute left-4 top-4 rounded-full bg-background/95 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
        {networkLabel}
      </span>
    </div>
  );
}

function roleLabel(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function statusLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateLabel(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function websiteHref(value: string | null) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  return `https://${value}`;
}

function agentsByAgency(agents: PublicAgencyAgent[]) {
  return agents.reduce((map, agent) => {
    const current = map.get(agent.agencyId) || [];
    current.push(agent);
    map.set(agent.agencyId, current);
    return map;
  }, new Map<string, PublicAgencyAgent[]>());
}

function AgentRow({ agent }: { agent: PublicAgencyAgent }) {
  const content = (
    <span className="flex min-w-0 items-center gap-3">
      <AgentProfileAvatar avatarUrl={agent.avatarUrl} name={agent.name} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{agent.name}</span>
        <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
          {agent.username ? `@${agent.username}` : "Homzie agent"} · {roleLabel(agent.role)}
        </span>
      </span>
    </span>
  );

  if (agent.username) {
    return (
      <Link
        href={`/users/${agent.username}`}
        className="grid min-w-0 gap-3 rounded-md px-3 py-3 transition hover:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      >
        {content}
        <span className="text-xs font-semibold text-muted-foreground">
          {agent.activeListingCount} active · {agent.soldListingCount} sold
        </span>
      </Link>
    );
  }

  return (
    <div className="grid min-w-0 gap-3 rounded-md px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      {content}
      <span className="text-xs font-semibold text-muted-foreground">
        {agent.activeListingCount} active · {agent.soldListingCount} sold
      </span>
    </div>
  );
}

function TeamSection({ agency }: { agency: PublicAgencyProfile }) {
  const groupedAgents = agentsByAgency(agency.agents);

  if (!agency.agents.length) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Team
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">
          No public agents yet
        </h2>
        <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
          Active agency agents will appear here once their profiles are visible.
        </p>
      </section>
    );
  }

  if (agency.type === "network") {
    return (
      <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Network team
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Agents by linked branch
            </h2>
            <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
              Expand a branch to see the active public agents attached to it.
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
            {agency.agents.length} total
          </span>
        </div>

        <div className="mt-5 divide-y divide-border overflow-hidden rounded-lg border border-border">
          {agency.branches.map((branch, index) => {
            const branchAgents = groupedAgents.get(branch.id) || [];

            return (
              <details key={branch.id} className="group bg-background" open={index === 0}>
                <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 transition hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {branch.name}
                    </span>
                    <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                      {branch.location || "Location not set"}
                      {branch.branchCode ? ` · ${branch.branchCode}` : ""}
                    </span>
                  </span>
                  <span className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground sm:w-80">
                    <span className="rounded-md bg-muted px-2 py-1.5">
                      {branchAgents.length} agents
                    </span>
                    <span className="rounded-md bg-muted px-2 py-1.5">
                      {branch.activeListingCount} active
                    </span>
                    <span className="rounded-md bg-muted px-2 py-1.5">
                      {branch.soldListingCount} sold
                    </span>
                  </span>
                </summary>
                <div className="border-t border-border px-1 py-2">
                  {branchAgents.length ? (
                    branchAgents.map((agent) => (
                      <AgentRow key={`${branch.id}-${agent.id}`} agent={agent} />
                    ))
                  ) : (
                    <p className="px-3 py-4 text-sm font-normal text-muted-foreground">
                      No public agents are attached to this branch yet.
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        Team
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Agents</h2>
          <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
            Public profiles currently connected to this agency.
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
          {agency.agents.length} total
        </span>
      </div>
      <div className="mt-5 divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
        {agency.agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} />
        ))}
      </div>
    </section>
  );
}

function BranchRollup({ agency }: { agency: PublicAgencyProfile }) {
  if (agency.type !== "network") return null;

  return (
    <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        Branches
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Linked branches</h2>
          <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
            Branch agencies that currently roll up into this network brand.
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
          {agency.branches.length} linked
        </span>
      </div>

      {agency.branches.length ? (
        <div className="mt-5 grid gap-3">
          {agency.branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/agencies/${branch.slug}`}
              className="grid gap-4 rounded-lg border border-border bg-background p-4 transition hover:border-primary/50 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {branch.name}
                </span>
                <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                  {branch.location || "Location not set"}
                  {branch.branchCode ? ` · ${branch.branchCode}` : ""}
                </span>
              </span>
              <span className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground sm:w-80">
                <span className="rounded-md bg-muted px-2 py-1.5">
                  {branch.agentCount} agents
                </span>
                <span className="rounded-md bg-muted px-2 py-1.5">
                  {branch.activeListingCount} active
                </span>
                <span className="rounded-md bg-muted px-2 py-1.5">
                  {branch.soldListingCount} sold
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-semibold">No linked branches yet</p>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            Linked branch agencies will appear here once the network accepts them.
          </p>
        </div>
      )}
    </section>
  );
}

function ListingsSection({ agency }: { agency: PublicAgencyProfile }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        Listings
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Public listings</h2>
          <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
            Published, reserved, and sold listings connected to this brand graph.
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
          Showing {agency.listings.length}
        </span>
      </div>

      {agency.listings.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {agency.listings.map((listing) => (
            <Link
              key={listing.id}
              href={listing.href}
              className="group grid overflow-hidden rounded-lg border border-border bg-background transition hover:border-primary/50 hover:shadow-sm sm:grid-cols-[9rem_minmax(0,1fr)]"
            >
              <span className="relative block aspect-[4/3] bg-muted sm:aspect-auto">
                {listing.coverImageUrl ? (
                  <Image
                    src={listing.coverImageUrl}
                    alt={listing.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <span className="grid size-full place-items-center text-muted-foreground">
                    <Home className="size-7" />
                  </span>
                )}
              </span>
              <span className="min-w-0 p-4">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {listing.listingTypeLabel}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {statusLabel(listing.status)}
                  </span>
                </span>
                <span className="mt-3 block line-clamp-2 text-sm font-semibold group-hover:text-primary">
                  {listing.title}
                </span>
                <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                  {listing.propertyTypeLabel} · {listing.location}
                </span>
                <span className="mt-3 block text-base font-semibold">
                  {listing.priceLabel}
                </span>
                <span className="mt-2 block truncate text-xs font-normal text-muted-foreground">
                  {listing.agentUsername
                    ? `@${listing.agentUsername}`
                    : listing.agentName}
                  {agency.type === "network" ? ` · ${listing.agencyName}` : ""}
                </span>
                {formatDateLabel(listing.listedAt) ? (
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Listed {formatDateLabel(listing.listedAt)}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-semibold">No public listings yet</p>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            Listings will appear here once agents publish public properties.
          </p>
        </div>
      )}
    </section>
  );
}

export default async function AgencyProfilePage({ params }: AgencyProfilePageProps) {
  const { slug } = await params;
  const [session, agency] = await Promise.all([
    getServerSession(authOptions),
    getPublicAgencyProfile(slug),
  ]);

  if (!agency) notFound();

  const viewer = await getViewerChrome(session?.user?.id);
  const networkLabel =
    agency.type === "network"
      ? "Network HQ"
      : agency.parentAgency
        ? "Linked branch agency"
        : publicAgencyTypeLabel(agency.type);
  const externalWebsite = websiteHref(agency.websiteUrl);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader
        viewerAvatarUrl={viewer.avatarUrl}
        viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace}
        viewerName={viewer.name}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />
      <main className="page-body pb-16 pt-28">
        <Link
          href="/agencies"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to agency search
        </Link>

        <section className="border-b border-border pb-8">
          <AgencyHeroBanner brand={agency.brand} networkLabel={networkLabel} />
          <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-5xl">
                {agency.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-normal leading-6 text-muted-foreground md:text-base">
                {agency.location || "Location not set"}
                {agency.parentAgency ? (
                  <>
                    {" "}
                    · Linked to{" "}
                    <Link
                      href={`/agencies/${agency.parentAgency.slug}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {agency.parentAgency.name}
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {externalWebsite ? (
                <Button asChild variant="outline">
                  <Link href={externalWebsite} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    Website
                  </Link>
                </Button>
              ) : null}
              <Button asChild>
                <Link href="#listings">
                  <ArrowUpRight className="size-4" />
                  View listings
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            helper={
              agency.type === "network"
                ? "Linked branch agencies in this network."
                : "Branch count applies to network HQs."
            }
            icon={Network}
            label="Branches"
            value={agency.branchCount}
          />
          <StatCard
            helper={
              agency.type === "network"
                ? "Public agents across linked branches."
                : "Public agents linked to this agency."
            }
            icon={UsersRound}
            label="Agents"
            value={agency.agents.length}
          />
          <StatCard
            helper="Published public listings right now."
            icon={Building2}
            label="Active listings"
            value={agency.activeListingCount}
          />
          <StatCard
            helper="Recorded sold listings tied to this brand graph."
            icon={ListChecks}
            label="Sold listings"
            value={agency.soldListingCount}
          />
        </section>

        <div className="mt-8 grid gap-8">
          <BranchRollup agency={agency} />
          <TeamSection agency={agency} />
          <div id="listings">
            <ListingsSection agency={agency} />
          </div>
        </div>
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}

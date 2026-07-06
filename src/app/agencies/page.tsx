import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowUpRight, Building2, Network, Search, SlidersHorizontal } from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import { AgencyBrandBadge } from "@/modules/agencies/components/agency-brand-badge";
import {
  getAgencyDirectory,
  normalizeAgencyTypeParam,
  publicAgencyTypeLabel,
  type PublicAgencyType,
} from "@/modules/agencies/public-directory";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";

type AgenciesPageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: string;
  }>;
};

const agencyTypeOptions: Array<{ label: string; value: PublicAgencyType | "" }> = [
  { label: "All surfaces", value: "" },
  { label: "Network HQ", value: "network" },
  { label: "Branch agencies", value: "branch" },
  { label: "Independent agencies", value: "independent" },
];

function cleanParam(value?: string) {
  return typeof value === "string" ? value.trim() : "";
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function AgenciesPage({ searchParams }: AgenciesPageProps) {
  const session = await getServerSession(authOptions);
  const viewer = await getViewerChrome(session?.user?.id);
  const query = searchParams ? await searchParams : {};
  const q = cleanParam(query.q);
  const type = normalizeAgencyTypeParam(query.type);
  const agencies = await getAgencyDirectory({ q, type });

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
        <section className="mb-8 border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Agencies
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            Search agency brands
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-normal leading-6 text-muted-foreground">
            Find Network HQs, branch agencies, and independent agencies, then open a
            live breakdown of their agents, branches, and public listings.
          </p>
        </section>

        <form
          action="/agencies"
          className="mb-7 grid gap-3 border-b border-border pb-5 lg:grid-cols-[minmax(18rem,1fr)_16rem_auto]"
        >
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>Search brands</span>
            <span className="flex h-12 items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-primary">
              <Search className="size-4 text-muted-foreground" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Agency, network, branch, location"
                className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground"
              />
            </span>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>Surface</span>
            <select
              name="type"
              defaultValue={type}
              className="h-12 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary"
            >
              {agencyTypeOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" className="h-12">
              <SlidersHorizontal className="size-4" />
              Apply
            </Button>
            {q || type ? (
              <Button asChild type="button" variant="outline" className="h-12">
                <Link href="/agencies">Reset</Link>
              </Button>
            ) : null}
          </div>
        </form>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-bold">
          <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
            {countLabel(agencies.length, "brand")}
          </span>
          {type ? (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
              {publicAgencyTypeLabel(type)}
            </span>
          ) : null}
        </div>

        {agencies.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agencies.map((agency) => (
              <Link
                key={agency.id}
                href={`/agencies/${agency.slug}`}
                className="group flex min-h-56 flex-col rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <AgencyBrandBadge brand={agency.brand} className="max-w-full" />
                    <h2 className="mt-4 line-clamp-2 text-xl font-semibold tracking-tight group-hover:text-primary">
                      {agency.name}
                    </h2>
                    <p className="mt-1 text-sm font-normal text-muted-foreground">
                      {publicAgencyTypeLabel(agency.type)}
                      {agency.location ? ` · ${agency.location}` : ""}
                    </p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    {agency.type === "network" ? (
                      <Network className="size-4" />
                    ) : (
                      <Building2 className="size-4" />
                    )}
                  </span>
                </div>

                <div className="mt-auto grid grid-cols-3 gap-2 pt-6 text-sm font-semibold">
                  <span className="rounded-md bg-muted px-3 py-2">
                    <span className="block text-lg leading-none">
                      {agency.branchCount}
                    </span>
                    <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Branches
                    </span>
                  </span>
                  <span className="rounded-md bg-muted px-3 py-2">
                    <span className="block text-lg leading-none">
                      {agency.agentCount}
                    </span>
                    <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Agents
                    </span>
                  </span>
                  <span className="rounded-md bg-muted px-3 py-2">
                    <span className="block text-lg leading-none">
                      {agency.activeListingCount}
                    </span>
                    <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Listings
                    </span>
                  </span>
                </div>

                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Open breakdown
                  <ArrowUpRight className="size-4" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center border-y border-dashed border-border p-8 text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Search className="size-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">No agency brands found</h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-normal leading-6 text-muted-foreground">
                Try a broader brand name, branch name, or location search.
              </p>
            </div>
          </div>
        )}
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}

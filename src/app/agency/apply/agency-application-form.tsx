"use client";

import { useActionState, useState } from "react";
import { Building2, Globe2, Mail, MapPin, Phone } from "lucide-react";

import { AnalyticsInfoPopover } from "@/components/analytics-info-popover";
import { Button } from "@/components/ui/button";
import type { AgencyNetworkOption } from "@/modules/agencies/server";
import { AgencyRegionField } from "@/modules/auth/components/auth-form";
import {
  createAgencyApplicationAction,
  type AgencyApplicationState,
} from "@/modules/agencies/actions";

const initialState: AgencyApplicationState = {};

export function AgencyApplicationForm({
  networkOptions = [],
}: {
  networkOptions?: AgencyNetworkOption[];
}) {
  const [agencyType, setAgencyType] = useState<"independent" | "network" | "branch">(
    "independent",
  );
  const [state, action, isPending] = useActionState(
    createAgencyApplicationAction,
    initialState,
  );

  return (
    <form action={action} className="mt-6 grid gap-4">
      {state.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <span className="flex items-center gap-1.5 text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Agency structure
          <AnalyticsInfoPopover
            title="Agency structure"
            description="Choose Independent for a standalone agency, Network HQ for a parent brand, or Branch for a local office requesting affiliation to an existing Network HQ."
          />
        </span>
        <div className="grid gap-2 md:grid-cols-3">
          {[
            {
              description: "One agency workspace.",
              label: "Independent",
              value: "independent" as const,
            },
            {
              description: "Parent/global brand.",
              label: "Network HQ",
              value: "network" as const,
            },
            {
              description: "Local office in a network.",
              label: "Branch",
              value: "branch" as const,
            },
          ].map((item) => {
            const selected = agencyType === item.value;

            return (
              <button
                key={item.value}
                type="button"
                className={[
                  "rounded-lg border px-3 py-3 text-left transition",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                ].join(" ")}
                onClick={() => setAgencyType(item.value)}
                aria-pressed={selected}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs font-semibold leading-5">
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <input type="hidden" name="agencyType" value={agencyType} />

      <label className="grid gap-2">
        <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          {agencyType === "network" ? "Network name" : "Agency name"}
        </span>
        <span className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <input
            name="name"
            required
            minLength={2}
            placeholder={
              agencyType === "network" ? "Century 21 South Africa" : "Century 21 Paarl"
            }
            className="h-12 min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground/70"
          />
        </span>
      </label>

      {agencyType === "branch" ? (
        <label className="grid gap-2">
          <span className="flex items-center gap-1.5 text-xs font-normal uppercase tracking-wide text-muted-foreground">
            Parent Network HQ
            <AnalyticsInfoPopover
              title="Parent Network HQ"
              description="Select the existing Network HQ this branch belongs to. Homzie sends an affiliation request to that HQ for approval."
            />
          </span>
          <span className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <select
              name="parentAgencyId"
              required
              disabled={!networkOptions.length}
              className="h-12 min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground/70"
            >
              <option value="">
                {networkOptions.length
                  ? "Select a Network HQ"
                  : "No Network HQs available yet"}
              </option>
              {networkOptions.map((network) => (
                <option key={network.id} value={network.id}>
                  {[network.label, network.region || network.location]
                    .filter(Boolean)
                    .join(" - ")}
                </option>
              ))}
            </select>
          </span>
          {!networkOptions.length ? (
            <span className="text-xs font-normal text-muted-foreground">
              Create the Network HQ first, then create this branch workspace.
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
            Contact email
          </span>
          <span className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <input
              name="contactEmail"
              type="email"
              placeholder="admin@agency.co.za"
              className="h-12 min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground/70"
            />
          </span>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
            Contact phone
          </span>
          <span className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Phone className="size-4 shrink-0 text-muted-foreground" />
            <input
              name="contactPhone"
              placeholder="+27..."
              className="h-12 min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground/70"
            />
          </span>
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Website
        </span>
        <span className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
          <Globe2 className="size-4 shrink-0 text-muted-foreground" />
          <input
            name="websiteUrl"
            type="url"
            placeholder="https://agency.co.za"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground/70"
          />
        </span>
      </label>

      {agencyType !== "network" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <AgencyRegionField />

          {agencyType === "branch" ? (
            <label className="grid gap-2">
              <span className="flex items-center gap-1.5 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                Branch code
                <AnalyticsInfoPopover
                  title="Branch code"
                  description="Optional internal code used by the agency or franchise network to identify this branch."
                />
              </span>
              <input
                name="branchCode"
                placeholder="PAARL-01"
                maxLength={32}
                className="h-12 rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none placeholder:text-muted-foreground/70"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <label className="grid gap-2">
        <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Primary area
        </span>
        <span className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <input
            name="location"
            placeholder="Paarl, Western Cape"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground/70"
          />
        </span>
      </label>

      <Button
        type="submit"
        disabled={isPending}
        className="mt-2 h-12 w-full rounded-md font-semibold"
      >
        {isPending ? "Creating agency..." : "Create Agency HQ"}
      </Button>
    </form>
  );
}

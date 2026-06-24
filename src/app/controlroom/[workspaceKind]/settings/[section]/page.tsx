import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Crown,
  Settings2,
  Share2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { sql } from "@/db";
import { toPublicMediaUrl } from "@/media/paths";
import {
  agencyBadgeStyleFromSettings,
  agencyControlRoomLogoPathFromSettings,
} from "@/modules/agencies/brand-style";
import {
  approveBranchLinkAction,
  declineBranchLinkAction,
  requestAgencyOwnershipTransferAction,
  updateAgencyBrandIdentityAction,
  updateBranchBrandingPolicyAction,
  updateNetworkBrandingPolicyAction,
} from "@/modules/agencies/actions";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import {
  agencyBillingModeLabel,
  agencyBrandingPolicyLabel,
  agencyTypeLabel,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";
import { AgencyBrandingForm } from "./agency-branding-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control Room Settings | Homzie",
  description: "Manage agency and network control room settings.",
};

type ControlRoomSettingsPageProps = {
  params: Promise<{
    section: string;
    workspaceKind: string;
  }>;
};

type SettingsSection = "branding" | "hierarchy" | "ownership" | "permissions";

const sectionMeta: Record<SettingsSection, { description: string; title: string }> = {
  branding: {
    description: "Manage logo, badge label, Network HQ branding rules, and branch brand locks.",
    title: "Branding",
  },
  hierarchy: {
    description: "Review network links, branch status, billing posture, and visibility.",
    title: "Hierarchy",
  },
  ownership: {
    description: "Transfer agency or Network HQ ownership to another verified Homzie account.",
    title: "Ownership",
  },
  permissions: {
    description: "Review what your current role can access inside this control room.",
    title: "Permissions",
  },
};

function parseSettingsSection(value: string): SettingsSection | null {
  if (
    value === "branding" ||
    value === "hierarchy" ||
    value === "ownership" ||
    value === "permissions"
  ) {
    return value;
  }

  return null;
}

type ParentAgencyRow = {
  badge_label: string | null;
  id: string;
  logo_url: string | null;
  name: string;
  settings: unknown;
  slug: string;
};

type BranchAgencyRow = {
  branch_code: string | null;
  branding_policy: "branch_branding_allowed" | "network_branding_enforced";
  id: string;
  name: string;
  parent_link_status: "none" | "pending" | "linked" | "declined";
  region: string | null;
  requested_parent_agency_name: string | null;
  slug: string;
};

type OutgoingTransferRow = {
  expires_at: Date;
  id: string;
  recipient_email: string;
  recipient_name: string | null;
};

export default async function ControlRoomSettingsPage({
  params,
}: ControlRoomSettingsPageProps) {
  const [{ section: sectionParam, workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) {
    redirect("/controlroom");
  }

  const section = parseSettingsSection(sectionParam);

  if (!section) {
    redirect(`/controlroom/${kind}/settings`);
  }

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/controlroom/${kind}/settings/${section}`);
  }

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace) {
    redirect(`/controlroom/${kind}`);
  }

  if (controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(`${controlRoomPathForWorkspace(workspace)}/settings/${section}`);
  }

  const [parentRows, branchRows, outgoingTransferRows] = await Promise.all([
    workspace.agency.parentAgencyId
      ? sql<ParentAgencyRow[]>`
          SELECT id, name, slug, logo_url, badge_label, settings
          FROM agencies
          WHERE id = ${workspace.agency.parentAgencyId}
          LIMIT 1
        `
      : Promise.resolve([] as ParentAgencyRow[]),
    workspace.agency.agencyType === "network"
      ? sql<BranchAgencyRow[]>`
          SELECT
            id,
            name,
            slug,
            branch_code,
            branding_policy,
            region,
            parent_link_status,
            requested_parent_agency_name
          FROM agencies
          WHERE agency_type = 'branch'
            AND (
              parent_agency_id = ${workspace.agency.id}
              OR (
                parent_agency_id IS NULL
                AND parent_link_status = 'pending'
                AND lower(trim(coalesce(requested_parent_agency_name, ''))) = lower(trim(${workspace.agency.name}))
              )
            )
          ORDER BY
            CASE parent_link_status WHEN 'pending' THEN 0 WHEN 'linked' THEN 1 ELSE 2 END,
            name ASC
        `
      : Promise.resolve([] as BranchAgencyRow[]),
    workspace.membership.role === "owner"
      ? sql<OutgoingTransferRow[]>`
          SELECT
            t.id,
            t.recipient_email,
            t.expires_at,
            u.name AS recipient_name
          FROM agency_ownership_transfers t
          LEFT JOIN users u ON u.id = t.recipient_user_id
          WHERE t.agency_id = ${workspace.agency.id}
            AND t.status = 'pending'
            AND t.expires_at > now()
          ORDER BY t.created_at DESC
        `
      : Promise.resolve([] as OutgoingTransferRow[]),
  ]);
  const parentAgency = parentRows[0] || null;
  const branchUsesNetworkBrand =
    workspace.agency.agencyType === "branch" &&
    workspace.agency.brandingPolicy === "network_branding_enforced" &&
    workspace.agency.parentLinkStatus === "linked" &&
    Boolean(parentAgency);
  const canManageControlRoomBrand = workspace.membership.canManageMembers;
  const canManagePublicBrand =
    workspace.membership.canManageMembers && !branchUsesNetworkBrand;
  const effectivePublicBrand = branchUsesNetworkBrand && parentAgency
    ? {
        badgeLabel: parentAgency.badge_label || parentAgency.name,
        badgeStyle: agencyBadgeStyleFromSettings(parentAgency.settings),
        logoUrl: toPublicMediaUrl(parentAgency.logo_url),
        name: parentAgency.name,
        sourceLabel: "Network HQ brand",
      }
    : {
        badgeLabel: workspace.agency.badgeLabel || workspace.agency.name,
        badgeStyle: agencyBadgeStyleFromSettings(workspace.agency.settings),
        logoUrl: toPublicMediaUrl(workspace.agency.logoUrl),
        name: workspace.agency.name,
        sourceLabel: "Local agency brand",
      };
  const settingsPath = `/controlroom/${kind}/settings`;
  const currentSection = sectionMeta[section];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href={settingsPath}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        Settings
      </Link>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Control room settings
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            {currentSection.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
            {currentSection.description}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-black text-muted-foreground shadow-sm">
          <BadgeCheck className="size-4 text-primary" />
          {agencyTypeLabel(workspace.agency.agencyType)}
        </span>
      </div>

      {section === "hierarchy" ? (
      <section
        id="hierarchy"
        className="mt-6 scroll-mt-24 rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              Hierarchy
            </p>
            <h2 className="mt-2 text-xl font-black">
              {agencyTypeLabel(workspace.agency.agencyType)}
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-black text-muted-foreground">
            <Share2 className="size-4 text-primary" />
            {workspace.agency.networkVisibilityEnabled
              ? "Visible to linked network"
              : "Branch-private"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              Parent network
            </p>
            <p className="mt-1 truncate text-sm font-black">
              {parentAgency?.name ||
                workspace.agency.requestedParentAgencyName ||
                (workspace.agency.agencyType === "network"
                  ? "This is the network HQ"
                  : "None")}
            </p>
            {workspace.agency.parentLinkStatus === "pending" ||
            workspace.agency.parentLinkStatus === "declined" ? (
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {workspace.agency.parentLinkStatus === "declined"
                  ? "Network link declined"
                  : "Pending network link"}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              Billing mode
            </p>
            <p className="mt-1 text-sm font-black">
              {agencyBillingModeLabel(workspace.agency.billingMode)}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Parent billing activates when a branch links to a network.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              Region
            </p>
            <p className="mt-1 truncate text-sm font-black">
              {workspace.agency.region || workspace.agency.location || "Not set"}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              Branding
            </p>
            <p className="mt-1 truncate text-sm font-black">
              {agencyBrandingPolicyLabel(workspace.agency.brandingPolicy)}
            </p>
          </div>
        </div>
      </section>
      ) : null}

      {section === "branding" ? (
      <>
      <section
        id="branding"
        className="mt-6 scroll-mt-24 rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              Brand identity
            </p>
            <h2 className="mt-2 text-xl font-black">
              {workspace.agency.agencyType === "network"
                ? "Canonical Network HQ brand"
                : "Agency brand"}
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
              {workspace.agency.agencyType === "network"
                ? "This is the brand branches and linked agents will inherit when Network HQ branding is enforced."
                : branchUsesNetworkBrand
                  ? "Your control room identity stays local, but public listing and agent badges are currently inherited from Network HQ."
                  : "This is the local agency brand used when branch branding is allowed."}
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-black text-muted-foreground">
            {branchUsesNetworkBrand ? "Locked by Network HQ" : "Editable"}
          </span>
        </div>

        <AgencyBrandingForm
          action={updateAgencyBrandIdentityAction}
          agencyName={workspace.agency.name}
          badgeLabel={workspace.agency.badgeLabel || workspace.agency.name}
          badgeStyle={agencyBadgeStyleFromSettings(workspace.agency.settings)}
          canManageControlRoomBrand={canManageControlRoomBrand}
          canManagePublicBrand={canManagePublicBrand}
          controlRoomLogoUrl={toPublicMediaUrl(
            agencyControlRoomLogoPathFromSettings(workspace.agency.settings),
          )}
          effectivePublicBrand={effectivePublicBrand}
          isNetworkBrandLocked={branchUsesNetworkBrand}
          localPublicBrand={{
            badgeLabel: workspace.agency.badgeLabel || workspace.agency.name,
            badgeStyle: agencyBadgeStyleFromSettings(workspace.agency.settings),
            logoUrl: toPublicMediaUrl(workspace.agency.logoUrl),
            name: workspace.agency.name,
          }}
          publicLogoUrl={toPublicMediaUrl(workspace.agency.logoUrl)}
        />
      </section>

      {workspace.agency.agencyType === "network" ? (
        <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                Network branding
              </p>
              <h2 className="mt-2 text-xl font-black">
                Branch brand governance
              </h2>
            </div>
            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-black text-muted-foreground">
              {branchRows.length} {branchRows.length === 1 ? "branch" : "branches"}
            </span>
          </div>

          <form
            action={updateNetworkBrandingPolicyAction}
            className="mt-4 rounded-lg border border-border bg-background p-4"
          >
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Default branch policy
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="grid gap-2">
                <span className="text-sm font-black">Default policy</span>
                <select
                  name="brandingPolicy"
                  defaultValue={workspace.agency.brandingPolicy}
                  className="h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  <option value="branch_branding_allowed">
                    Branches may use their own branding
                  </option>
                  <option value="network_branding_enforced">
                    Enforce Network HQ branding
                  </option>
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <input
                    name="applyToBranches"
                    type="checkbox"
                    className="size-4 rounded border-border"
                  />
                  Apply to linked branches
                </label>
                <Button type="submit" className="h-10 font-black">
                  Save rule
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            {branchRows.length ? (
              <div className="divide-y divide-border">
                {branchRows.map((branch) => {
                  const isPending = branch.parent_link_status === "pending";

                  return (
                    <div
                      key={branch.id}
                      className="grid gap-3 bg-background p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-black">{branch.name}</p>
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-[10px] font-black uppercase",
                              isPending
                                ? "bg-red-500/10 text-red-600"
                                : "bg-emerald-500/10 text-emerald-700",
                            ].join(" ")}
                          >
                            {isPending ? "Pending link" : "Linked"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          {[branch.region, branch.branch_code]
                            .filter(Boolean)
                            .join(" · ") || "No region or branch code yet"}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          {agencyBrandingPolicyLabel(branch.branding_policy)}
                        </p>
                      </div>

                      {isPending ? (
                        <div className="flex flex-wrap gap-2">
                          <form action={approveBranchLinkAction}>
                            <input
                              type="hidden"
                              name="branchAgencyId"
                              value={branch.id}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              className="h-9 px-3 text-xs font-black"
                            >
                              <CheckCircle2 className="size-4" />
                              Approve
                            </Button>
                          </form>
                          <form action={declineBranchLinkAction}>
                            <input
                              type="hidden"
                              name="branchAgencyId"
                              value={branch.id}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              className="h-9 px-3 text-xs font-black"
                            >
                              <XCircle className="size-4" />
                              Decline
                            </Button>
                          </form>
                        </div>
                      ) : (
                        <form
                          action={updateBranchBrandingPolicyAction}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="branchAgencyId"
                            value={branch.id}
                          />
                          <select
                            name="brandingPolicy"
                            defaultValue={branch.branding_policy}
                            className="h-9 rounded-md border border-border bg-card px-2 text-xs font-black outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                            aria-label={`Branding policy for ${branch.name}`}
                          >
                            <option value="branch_branding_allowed">
                              Own branding
                            </option>
                            <option value="network_branding_enforced">
                              Network brand
                            </option>
                          </select>
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 text-xs font-black"
                          >
                            Save
                          </Button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-background p-4 text-sm font-semibold text-muted-foreground">
                Branches that request to link to {workspace.agency.name} will appear
                here for approval.
              </div>
            )}
          </div>
        </section>
      ) : null}
      </>
      ) : null}

      {section === "ownership" ? (
      workspace.membership.role === "owner" ? (
        <section
          id="ownership"
          className="mt-6 scroll-mt-24 rounded-lg border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                Ownership
              </p>
              <h2 className="mt-2 text-xl font-black">Transfer agency ownership</h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-black text-muted-foreground">
              <Crown className="size-4 text-primary" />
              Current owner
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <form
              action={requestAgencyOwnershipTransferAction}
              className="rounded-lg border border-border bg-background p-4"
            >
              <label className="block text-xs font-black uppercase tracking-wide text-muted-foreground">
                New owner email
              </label>
              <input
                name="recipientEmail"
                type="email"
                required
                placeholder="new.owner@example.com"
                className="mt-2 h-11 w-full rounded-md border border-border bg-card px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
              <label className="mt-4 block text-xs font-black uppercase tracking-wide text-muted-foreground">
                Message
              </label>
              <textarea
                name="message"
                rows={3}
                maxLength={500}
                placeholder="Optional note for the incoming owner"
                className="mt-2 w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              />
              <Button type="submit" className="mt-4 h-10 font-black">
                Send transfer request
              </Button>
            </form>

            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                Pending transfer
              </p>
              {outgoingTransferRows.length ? (
                <div className="mt-3 grid gap-2">
                  {outgoingTransferRows.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="rounded-md border border-border bg-card p-3"
                    >
                      <p className="text-sm font-black">
                        {transfer.recipient_name || transfer.recipient_email}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        Waiting for {transfer.recipient_email} to accept.
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold leading-6 text-muted-foreground">
                  No ownership transfer is pending. Sending a new request cancels any
                  previous pending request for this agency.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section
          id="ownership"
          className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm"
        >
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
            Ownership
          </p>
          <h2 className="mt-2 text-xl font-black">Owner access required</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            Ownership transfers are only available to the current agency or Network
            HQ owner. Admins and employees can view other settings based on their
            assigned permissions.
          </p>
        </section>
      )
      ) : null}

      {section === "permissions" ? (
      <section
        id="permissions"
        className="mt-6 scroll-mt-24 rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              Permission baseline
            </p>
            <h2 className="mt-2 text-xl font-black">Your permissions</h2>
          </div>
          <Settings2 className="size-5 text-muted-foreground" />
        </div>
        <div className="mt-4 grid gap-2 text-sm font-semibold text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <p>Publish listings: {workspace.membership.canPublishListings ? "Yes" : "No"}</p>
          <p>Edit agency listings: {workspace.membership.canEditAgencyListings ? "Yes" : "No"}</p>
          <p>Buyer activity: {workspace.membership.canViewBuyerActivity ? "Yes" : "No"}</p>
          <p>Manage team: {workspace.membership.canManageMembers ? "Yes" : "No"}</p>
          <p>Manage billing: {workspace.membership.canManageBilling ? "Yes" : "No"}</p>
          <p>Submit requests: {workspace.membership.canSubmitListingRequests ? "Yes" : "No"}</p>
        </div>
      </section>
      ) : null}
    </main>
  );
}

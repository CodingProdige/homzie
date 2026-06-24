import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CheckCircle2, Network, XCircle } from "lucide-react";

import { CanonicalTable, type CanonicalTableColumn } from "@/components/ui/canonical-table";
import { Button } from "@/components/ui/button";
import { sql } from "@/db";
import {
  approveBranchLinkAction,
  declineBranchLinkAction,
  unlinkBranchAction,
} from "@/modules/agencies/actions";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import {
  agencyBillingModeLabel,
  agencyBrandingPolicyLabel,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Branches | Homzie Control Room",
  description: "Manage Network HQ branch links and affiliation requests.",
};

type BranchesPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
};

type BranchRow = {
  billing_mode: "parent" | "self";
  branch_code: string | null;
  branding_policy: "branch_branding_allowed" | "network_branding_enforced";
  created_at: Date;
  id: string;
  listing_count: number | string;
  member_count: number | string;
  name: string;
  owner_email: string | null;
  owner_name: string | null;
  parent_link_status: "none" | "pending" | "linked" | "declined";
  region: string | null;
  slug: string;
  status: "active" | "pending" | "suspended";
};

function statusBadge(status: BranchRow["parent_link_status"]) {
  const classes =
    status === "linked"
      ? "bg-emerald-500/10 text-emerald-700"
      : status === "pending"
        ? "bg-red-500/10 text-red-600"
        : "bg-muted text-muted-foreground";

  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${classes}`}>
      {status === "linked" ? "Linked" : status === "pending" ? "Pending" : status}
    </span>
  );
}

export default async function BranchesPage({ params }: BranchesPageProps) {
  const [{ workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) redirect("/controlroom");
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/controlroom/${kind}/branches`);

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace) redirect(`/controlroom/${kind}`);
  if (controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(`${controlRoomPathForWorkspace(workspace)}/branches`);
  }

  if (workspace.agency.agencyType !== "network") {
    redirect(controlRoomPathForWorkspace(workspace));
  }

  const canManageBranches = workspace.membership.canManageMembers;
  const branches = await sql<BranchRow[]>`
    SELECT
      a.id,
      a.name,
      a.slug,
      a.region,
      a.branch_code,
      a.parent_link_status,
      a.branding_policy,
      a.billing_mode,
      a.status,
      a.created_at,
      owner.name AS owner_name,
      owner.email AS owner_email,
      count(DISTINCT am.id)::int AS member_count,
      count(DISTINCT pl.id)::int AS listing_count
    FROM agencies a
    LEFT JOIN agency_members owner_member
      ON owner_member.agency_id = a.id
      AND owner_member.role = 'owner'
      AND owner_member.status <> 'removed'
    LEFT JOIN users owner ON owner.id = owner_member.user_id
    LEFT JOIN agency_members am
      ON am.agency_id = a.id
      AND am.status <> 'removed'
    LEFT JOIN property_listings pl
      ON pl.user_id = am.user_id
      AND pl.status = 'published'
    WHERE a.agency_type IN ('branch', 'independent')
      AND (
        a.parent_agency_id = ${workspace.agency.id}
        OR (
          a.parent_agency_id IS NULL
          AND a.parent_link_status = 'pending'
          AND lower(trim(coalesce(a.requested_parent_agency_name, ''))) = lower(trim(${workspace.agency.name}))
        )
      )
    GROUP BY
      a.id,
      owner.name,
      owner.email
    ORDER BY
      CASE a.parent_link_status WHEN 'pending' THEN 0 WHEN 'linked' THEN 1 ELSE 2 END,
      a.name ASC
  `;
  const pendingCount = branches.filter((branch) => branch.parent_link_status === "pending").length;
  const linkedCount = branches.filter((branch) => branch.parent_link_status === "linked").length;

  const columns: Array<CanonicalTableColumn<BranchRow>> = [
    {
      header: "Branch",
      key: "branch",
      render: (branch) => (
        <div className="min-w-0">
          <p className="truncate font-black">{branch.name}</p>
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
            {[branch.region, branch.branch_code].filter(Boolean).join(" · ") || "No region set"}
          </p>
        </div>
      ),
    },
    {
      header: "Status",
      key: "status",
      render: (branch) => statusBadge(branch.parent_link_status),
    },
    {
      header: "Owner",
      key: "owner",
      render: (branch) => (
        <div>
          <p className="truncate font-semibold">{branch.owner_name || "Owner not set"}</p>
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
            {branch.owner_email || "No owner email"}
          </p>
        </div>
      ),
    },
    {
      header: "Footprint",
      key: "footprint",
      render: (branch) => (
        <div className="text-sm font-semibold text-muted-foreground">
          <p>{Number(branch.member_count)} members</p>
          <p>{Number(branch.listing_count)} active listings</p>
        </div>
      ),
    },
    {
      header: "Policy",
      key: "policy",
      render: (branch) => (
        <div className="text-xs font-semibold leading-5 text-muted-foreground">
          <p>{agencyBillingModeLabel(branch.billing_mode)}</p>
          <p>{agencyBrandingPolicyLabel(branch.branding_policy)}</p>
        </div>
      ),
    },
    {
      className: "w-44",
      header: "Actions",
      key: "actions",
      render: (branch) => {
        if (!canManageBranches) {
          return <span className="text-xs font-black text-muted-foreground">View only</span>;
        }

        if (branch.parent_link_status === "pending") {
          return (
            <div className="flex flex-wrap gap-2">
              <form action={approveBranchLinkAction}>
                <input type="hidden" name="branchAgencyId" value={branch.id} />
                <Button size="sm" type="submit" className="h-8 px-2 text-xs font-black">
                  <CheckCircle2 className="size-4" />
                  Approve
                </Button>
              </form>
              <form action={declineBranchLinkAction}>
                <input type="hidden" name="branchAgencyId" value={branch.id} />
                <Button size="sm" type="submit" variant="outline" className="h-8 px-2 text-xs font-black">
                  <XCircle className="size-4" />
                  Decline
                </Button>
              </form>
            </div>
          );
        }

        if (branch.parent_link_status === "linked") {
          return (
            <form action={unlinkBranchAction}>
              <input type="hidden" name="branchAgencyId" value={branch.id} />
              <Button size="sm" type="submit" variant="outline" className="h-8 px-3 text-xs font-black">
                Unlink
              </Button>
            </form>
          );
        }

        return <span className="text-xs font-black text-muted-foreground">No action</span>;
      },
      useRowHref: false,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Network HQ
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Branches
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
            Review branch affiliation requests, linked branches, owners, and operating policies for {workspace.agency.name}. Network links never make the HQ liable for branch seat billing.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-black text-muted-foreground shadow-sm">
          <Network className="size-4 text-primary" />
          {linkedCount} linked · {pendingCount} pending
        </span>
      </div>

      <div className="mt-8">
        <CanonicalTable
          columns={columns}
          emptyState="No linked branches or branch requests yet."
          getRowKey={(branch) => branch.id}
          minWidth="900px"
          rows={branches}
        />
      </div>
    </main>
  );
}

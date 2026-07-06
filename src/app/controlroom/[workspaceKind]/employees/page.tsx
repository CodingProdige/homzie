import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ShieldCheck } from "lucide-react";

import { sql } from "@/db";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import { getPrimaryAgencyWorkspace } from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";
import {
  EmployeeManagement,
  type EmployeeManagementRow,
} from "./employee-management";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Employees | Homzie Control Room",
  description: "Manage unpaid internal control room employees.",
};

type EmployeesPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
};

export default async function EmployeesPage({ params }: EmployeesPageProps) {
  const [{ workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) redirect("/controlroom");
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/controlroom/${kind}/employees`);

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace) redirect(`/controlroom/${kind}`);
  if (controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(`${controlRoomPathForWorkspace(workspace)}/employees`);
  }

  const canManage = workspace.membership.canManageMembers;
  const includeBillingAccess = workspace.agency.agencyType !== "network";
  const employees = await sql<EmployeeManagementRow[]>`
    SELECT
      ae.id,
      ae.invited_email,
      ae.user_id,
      ae.role,
      ae.status,
      ae.can_manage_branding,
      ae.can_manage_listings,
      ae.can_manage_members,
      ae.can_manage_billing,
      ae.can_view_buyer_activity,
      u.name,
      u.username,
      u.email
    FROM agency_employees ae
    LEFT JOIN users u ON u.id = ae.user_id
    WHERE ae.agency_id = ${workspace.agency.id}
      AND ae.status <> 'removed'
    ORDER BY
      CASE ae.status WHEN 'active' THEN 0 WHEN 'invited' THEN 1 WHEN 'suspended' THEN 2 ELSE 3 END,
      CASE ae.role WHEN 'admin' THEN 0 WHEN 'listing_coordinator' THEN 1 WHEN 'marketing' THEN 2 WHEN 'finance' THEN 3 ELSE 4 END,
      coalesce(u.name, ae.invited_email) ASC
  `;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Internal workspace access
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Employees
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
            {workspace.agency.agencyType === "network"
              ? "Employees are internal users who help manage branch oversight, network branding, and control room operations."
              : "Employees are unpaid internal users. They can access control room operations based on role, but they do not appear as agents, do not receive public branding, and do not count as agency-funded seats."}
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-normal text-muted-foreground shadow-sm">
          <ShieldCheck className="size-4 text-primary" />
          {employees.length} employees
        </span>
      </div>

      <EmployeeManagement
        canManage={canManage}
        currentUserId={session.user.id}
        employees={employees}
        includeBillingAccess={includeBillingAccess}
      />
    </main>
  );
}

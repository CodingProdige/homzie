import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Mail, ShieldCheck, ShieldBan, UserCheck, UserPlus, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CanonicalTable, type CanonicalTableColumn } from "@/components/ui/canonical-table";
import { sql } from "@/db";
import {
  inviteAgencyEmployeeAction,
  updateAgencyEmployeeStatusAction,
} from "@/modules/agencies/actions";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import {
  agencyEmployeeRoleLabel,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";

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

type EmployeeRole = "admin" | "finance" | "listing_coordinator" | "marketing" | "viewer";

type EmployeeRow = {
  can_manage_billing: boolean;
  can_manage_branding: boolean;
  can_manage_listings: boolean;
  can_manage_members: boolean;
  can_view_buyer_activity: boolean;
  email: string | null;
  id: string;
  invited_email: string | null;
  name: string | null;
  role: EmployeeRole;
  status: "active" | "invited" | "removed" | "suspended";
  username: string | null;
};

function statusBadge(status: EmployeeRow["status"]) {
  const tone =
    status === "active"
      ? "bg-emerald-500/10 text-emerald-700"
      : status === "invited"
        ? "bg-primary/10 text-primary"
        : status === "suspended"
          ? "bg-amber-500/15 text-amber-700"
          : "bg-muted text-muted-foreground";

  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${tone}`}>
      {status}
    </span>
  );
}

function roleOption(value: EmployeeRole, title: string, helper: string) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background p-3 text-sm font-bold transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/8">
      <input
        type="radio"
        name="role"
        value={value}
        defaultChecked={value === "viewer"}
        className="mt-1 accent-primary"
      />
      <span>
        <span className="block font-black">{title}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">
          {helper}
        </span>
      </span>
    </label>
  );
}

function permissionList(employee: EmployeeRow) {
  const permissions = [
    employee.can_manage_members ? "members" : null,
    employee.can_manage_listings ? "listings" : null,
    employee.can_manage_branding ? "branding" : null,
    employee.can_manage_billing ? "billing" : null,
    employee.can_view_buyer_activity ? "buyer activity" : null,
  ].filter(Boolean);

  return permissions.length ? permissions.join(", ") : "view only";
}

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
  const employees = await sql<EmployeeRow[]>`
    SELECT
      ae.id,
      ae.invited_email,
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

  const columns: Array<CanonicalTableColumn<EmployeeRow>> = [
    {
      header: "Employee",
      key: "employee",
      render: (employee) => (
        <div className="min-w-0">
          <p className="truncate font-black">
            {employee.name || employee.invited_email || "Pending employee"}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
            {employee.username ? `@${employee.username}` : employee.email || employee.invited_email}
          </p>
        </div>
      ),
    },
    {
      header: "Role",
      key: "role",
      render: (employee) => (
        <div>
          <p className="font-black">{agencyEmployeeRoleLabel(employee.role)}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Unpaid internal access
          </p>
        </div>
      ),
    },
    {
      header: "Status",
      key: "status",
      render: (employee) => statusBadge(employee.status),
    },
    {
      header: "Access",
      key: "access",
      render: (employee) => (
        <p className="max-w-xs text-sm font-semibold leading-6 text-muted-foreground">
          {permissionList(employee)}
        </p>
      ),
    },
    {
      className: "w-56",
      header: "Actions",
      key: "actions",
      render: (employee) => {
        if (!canManage) {
          return <span className="text-xs font-black text-muted-foreground">View only</span>;
        }

        return (
          <div className="flex flex-wrap gap-2">
            <form action={updateAgencyEmployeeStatusAction}>
              <input type="hidden" name="employeeId" value={employee.id} />
              <input
                type="hidden"
                name="status"
                value={employee.status === "suspended" ? "active" : "suspended"}
              />
              <Button size="sm" type="submit" variant="outline" className="h-8 px-2 text-xs font-black">
                {employee.status === "suspended" ? (
                  <UserCheck className="size-4" />
                ) : (
                  <ShieldBan className="size-4" />
                )}
                {employee.status === "suspended" ? "Reactivate" : "Suspend"}
              </Button>
            </form>
            <form action={updateAgencyEmployeeStatusAction}>
              <input type="hidden" name="employeeId" value={employee.id} />
              <input type="hidden" name="status" value="removed" />
              <Button size="sm" type="submit" variant="outline" className="h-8 px-2 text-xs font-black">
                <XCircle className="size-4" />
                Remove
              </Button>
            </form>
          </div>
        );
      },
      useRowHref: false,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Internal workspace access
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Employees
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
            Employees are unpaid internal users. They can access control room operations based on role, but they do not appear as agents, do not receive public branding, and do not count as paid seats.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-black text-muted-foreground shadow-sm">
          <ShieldCheck className="size-4 text-primary" />
          {employees.length} employees
        </span>
      </div>

      {canManage ? (
        <form action={inviteAgencyEmployeeAction} className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1 text-sm font-black">
              Employee email
              <span className="mt-2 flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <input
                  required
                  type="email"
                  name="email"
                  placeholder="employee@example.com"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
                />
              </span>
            </label>
            <Button type="submit" className="h-11 px-5 font-black">
              <UserPlus className="size-4" />
              Invite employee
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {roleOption("viewer", "Viewer", "Can view allowed workspace pages.")}
            {roleOption("listing_coordinator", "Listing coordinator", "Can manage listing operations.")}
            {roleOption("marketing", "Marketing", "Can manage branding and buyer activity.")}
            {roleOption("finance", "Finance", "Can manage billing access.")}
            {roleOption("admin", "Admin", "Can manage employees and settings.")}
          </div>
        </form>
      ) : null}

      <section className="mt-8">
        <CanonicalTable
          columns={columns}
          emptyState="No internal employees yet."
          getRowKey={(employee) => employee.id}
          minWidth="760px"
          rows={employees}
        />
      </section>
    </main>
  );
}

"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Mail,
  MoreHorizontal,
  Pencil,
  ShieldBan,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from "lucide-react";

import {
  CanonicalTable,
  type CanonicalTableColumn,
} from "@/components/ui/canonical-table";
import { Button } from "@/components/ui/button";
import {
  inviteAgencyEmployeeAction,
  updateAgencyEmployeeRoleAction,
  updateAgencyEmployeeStatusAction,
  type AgencyEmployeeRole,
} from "@/modules/agencies/actions";

type EmployeeStatus = "active" | "invited" | "removed" | "suspended";

export type EmployeeManagementRow = {
  can_manage_billing: boolean;
  can_manage_branding: boolean;
  can_manage_listings: boolean;
  can_manage_members: boolean;
  can_view_buyer_activity: boolean;
  email: string | null;
  id: string;
  invited_email: string | null;
  name: string | null;
  role: AgencyEmployeeRole;
  status: EmployeeStatus;
  user_id: string | null;
  username: string | null;
};

type RoleOption = {
  description: string;
  label: string;
  value: AgencyEmployeeRole;
};

const baseRoleOptions: RoleOption[] = [
  {
    description: "Can view allowed workspace pages.",
    label: "Viewer",
    value: "viewer",
  },
  {
    description: "Can manage listing operations.",
    label: "Listing coordinator",
    value: "listing_coordinator",
  },
  {
    description: "Can manage branding and buyer activity.",
    label: "Marketing",
    value: "marketing",
  },
  {
    description: "Can manage billing access.",
    label: "Finance",
    value: "finance",
  },
  {
    description: "Can manage employees and settings.",
    label: "Admin",
    value: "admin",
  },
];

const networkRoleOptions: RoleOption[] = [
  {
    description: "Can view allowed workspace pages.",
    label: "Viewer",
    value: "viewer",
  },
  {
    description: "Can manage Network HQ branding.",
    label: "Marketing",
    value: "marketing",
  },
  {
    description: "Can manage employees, settings, and branches.",
    label: "Admin",
    value: "admin",
  },
];

function roleOptions(includeBillingAccess: boolean) {
  return includeBillingAccess
    ? baseRoleOptions
    : networkRoleOptions;
}

function roleLabel(role: AgencyEmployeeRole) {
  if (role === "listing_coordinator") return "Listing coordinator";

  return role[0].toUpperCase() + role.slice(1);
}

function statusBadge(status: EmployeeStatus) {
  const tone =
    status === "active"
      ? "bg-emerald-500/10 text-emerald-700"
      : status === "invited"
        ? "bg-primary/10 text-primary"
        : status === "suspended"
          ? "bg-amber-500/15 text-amber-700"
          : "bg-muted text-muted-foreground";

  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${tone}`}>
      {status}
    </span>
  );
}

function permissionList(employee: EmployeeManagementRow, includeBilling = true) {
  const permissions = [
    employee.can_manage_members ? "employees" : null,
    employee.can_manage_listings ? "listings" : null,
    employee.can_manage_branding ? "branding" : null,
    includeBilling && employee.can_manage_billing ? "billing" : null,
    includeBilling && employee.can_view_buyer_activity ? "buyer activity" : null,
  ].filter(Boolean);

  return permissions.length ? permissions.join(", ") : "view only";
}

function roleOption(option: RoleOption) {
  return (
    <label
      key={option.value}
      className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background p-3 text-sm font-bold transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/8"
    >
      <input
        type="radio"
        name="role"
        value={option.value}
        defaultChecked={option.value === "viewer"}
        className="mt-1 accent-primary"
      />
      <span>
        <span className="block font-semibold">{option.label}</span>
        <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
          {option.description}
        </span>
      </span>
    </label>
  );
}

function InviteEmployeeDialog({
  includeBillingAccess,
}: {
  includeBillingAccess: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const options = roleOptions(includeBillingAccess);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button className="h-11 px-5 font-semibold">
          <UserPlus className="size-4" />
          Invite employee
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] max-h-[90dvh] w-[min(94vw,42rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Internal workspace access
              </p>
              <Dialog.Title className="mt-2 text-2xl font-semibold">
                Invite employee
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                Add an internal control room user without creating an agency-funded public agent seat.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close invite dialog">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          <form
            ref={formRef}
            action={async (formData) => {
              setError(null);

              try {
                await inviteAgencyEmployeeAction(formData);
                formRef.current?.reset();
                setOpen(false);
              } catch (actionError) {
                setError(
                  actionError instanceof Error
                    ? actionError.message
                    : "Could not invite this employee.",
                );
              }
            }}
            className="mt-5"
          >
            <label className="text-sm font-semibold">
              Employee email
              <span className="mt-2 flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <input
                  required
                  type="email"
                  name="email"
                  placeholder="employee@example.com"
                  className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground"
                />
              </span>
            </label>

            <div
              className={`mt-4 grid gap-3 ${
                includeBillingAccess ? "md:grid-cols-5" : "md:grid-cols-3"
              }`}
            >
              {options.map(roleOption)}
            </div>

            {error ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" className="font-semibold">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" className="font-semibold">
                <UserPlus className="size-4" />
                Send invite
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditEmployeeRoleDialog({
  employee,
  includeBillingAccess,
  onOpenChange,
}: {
  employee: EmployeeManagementRow | null;
  includeBillingAccess: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const options = roleOptions(includeBillingAccess);
  const open = Boolean(employee);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] w-[min(94vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Employee role
              </p>
              <Dialog.Title className="mt-2 text-2xl font-semibold">
                Edit access
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                Update the control room role for {employee?.name || employee?.invited_email || "this employee"}.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close edit dialog">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          {employee ? (
            <form
              ref={formRef}
              action={async (formData) => {
                setError(null);

                try {
                  await updateAgencyEmployeeRoleAction(formData);
                  formRef.current?.reset();
                  onOpenChange(false);
                } catch (actionError) {
                  setError(
                    actionError instanceof Error
                      ? actionError.message
                      : "Could not update this employee.",
                  );
                }
              }}
              className="mt-5"
            >
              <input type="hidden" name="employeeId" value={employee.id} />
              <label className="grid gap-2 text-sm font-semibold">
                Role
                <select
                  name="role"
                  defaultValue={employee.role}
                  className="h-11 rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-xs font-normal leading-5 text-muted-foreground">
                The role controls permissions immediately after saving.
              </p>

              {error ? (
                <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline" className="font-semibold">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="submit" className="font-semibold">
                  Save role
                </Button>
              </div>
            </form>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EmployeeRowActions({
  employee,
  isSelf,
  onEdit,
}: {
  employee: EmployeeManagementRow;
  isSelf: boolean;
  onEdit: (employee: EmployeeManagementRow) => void;
}) {
  if (isSelf) {
    return <span className="text-xs font-normal text-muted-foreground">Your access</span>;
  }

  const canToggleStatus = employee.status !== "invited";
  const nextStatus = employee.status === "suspended" ? "active" : "suspended";
  const nextStatusLabel =
    employee.status === "suspended" ? "Reactivate employee" : "Suspend employee";
  const NextStatusIcon = employee.status === "suspended" ? UserCheck : ShieldBan;
  const removeLabel = employee.status === "invited" ? "Cancel invite" : "Remove employee";

  return (
    <div className="flex justify-end">
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Open employee actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-[90] min-w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
          >
            <DropdownMenu.Item asChild>
              <button
                type="button"
                onClick={() => onEdit(employee)}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-bold outline-none transition-colors hover:bg-muted focus:bg-muted"
              >
                <Pencil className="size-4 text-muted-foreground" />
                Edit role
              </button>
            </DropdownMenu.Item>
            {canToggleStatus ? (
              <form action={updateAgencyEmployeeStatusAction}>
                <input type="hidden" name="employeeId" value={employee.id} />
                <input type="hidden" name="status" value={nextStatus} />
                <DropdownMenu.Item asChild>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-bold outline-none transition-colors hover:bg-muted focus:bg-muted"
                  >
                    <NextStatusIcon className="size-4 text-muted-foreground" />
                    {nextStatusLabel}
                  </button>
                </DropdownMenu.Item>
              </form>
            ) : null}
            <form action={updateAgencyEmployeeStatusAction}>
              <input type="hidden" name="employeeId" value={employee.id} />
              <input type="hidden" name="status" value="removed" />
              <DropdownMenu.Item asChild>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-bold text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10"
                >
                  <UserX className="size-4" />
                  {removeLabel}
                </button>
              </DropdownMenu.Item>
            </form>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export function EmployeeManagement({
  canManage,
  currentUserId,
  employees,
  includeBillingAccess,
}: {
  canManage: boolean;
  currentUserId: string;
  employees: EmployeeManagementRow[];
  includeBillingAccess: boolean;
}) {
  const [editingEmployee, setEditingEmployee] = useState<EmployeeManagementRow | null>(null);

  const columns: Array<CanonicalTableColumn<EmployeeManagementRow>> = [
    {
      header: "Employee",
      key: "employee",
      render: (employee) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {employee.name || employee.invited_email || "Pending employee"}
          </p>
          <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
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
          <p className="font-semibold">{roleLabel(employee.role)}</p>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
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
        <p className="max-w-xs text-sm font-normal leading-6 text-muted-foreground">
          {permissionList(employee, includeBillingAccess)}
        </p>
      ),
    },
    {
      className: "w-20 text-right",
      header: "Actions",
      key: "actions",
      render: (employee) =>
        canManage ? (
          <EmployeeRowActions
            employee={employee}
            isSelf={Boolean(employee.user_id && employee.user_id === currentUserId)}
            onEdit={setEditingEmployee}
          />
        ) : (
          <span className="text-xs font-normal text-muted-foreground">View only</span>
        ),
      useRowHref: false,
    },
  ];

  return (
    <>
      {canManage ? (
        <div className="mt-8 flex justify-start">
          <InviteEmployeeDialog includeBillingAccess={includeBillingAccess} />
        </div>
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

      <EditEmployeeRoleDialog
        employee={editingEmployee}
        includeBillingAccess={includeBillingAccess}
        onOpenChange={(open) => {
          if (!open) setEditingEmployee(null);
        }}
      />
    </>
  );
}

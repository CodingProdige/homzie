"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useActionState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Clock3,
  CreditCard,
  Crown,
  DoorOpen,
  ExternalLink,
  Filter,
  Loader2,
  Network,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";

import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { startAdminAgencySupportAction } from "@/modules/agencies/admin-support-actions";
import {
  auditIncompleteTrialsAction,
  scheduleAdminAgencyBillingTransition,
  updateAdminProAccessOverride,
  updateAdminWorkspaceAccountType,
  type AdminAgencyBillingTransitionState,
  type AdminProAccessOverrideState,
  type AdminWorkspaceAccountTypeState,
} from "../actions";

export type AdminUserRow = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: "user" | "admin";
  status: "active" | "disabled";
  emailVerified: boolean;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  locationPlaceId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  publicContactVisible: boolean;
  agentProfileStatus: string | null;
  activeSubscriptionStatus: string | null;
  agentTrialUsedAt: string | null;
  proAccessOverrideEnabled: boolean;
  proAccessOverrideExpiresAt: string | null;
  proAccessOverrideReason: string | null;
  proAccessOverrideUpdatedAt: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionCurrentPeriodStart: string | null;
  agencyId: string | null;
  agencyName: string | null;
  agencySlug: string | null;
  agencyType: "independent" | "network" | "branch" | null;
  agencyStatus: "pending" | "active" | "suspended" | null;
  agencyMemberRole: "owner" | "admin" | "listing_manager" | "agent" | null;
  agencyMemberStatus: "invited" | "active" | "suspended" | "removed" | null;
  lastOnlineAt: string | null;
  listingCount: number;
  reelCount: number;
  createdAt: string;
  updatedAt: string;
};

const roleOptions = [
  { label: "All roles", value: "all" },
  { label: "Admins", value: "admin" },
  { label: "Users", value: "user" },
] as const;

const statusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Disabled", value: "disabled" },
] as const;

const accountTypeOptions = [
  { label: "All accounts", value: "all" },
  { label: "Personal", value: "personal" },
  { label: "Network HQ", value: "network" },
  { label: "Branch agencies", value: "branch" },
  { label: "Independent agencies", value: "independent" },
] as const;

const subscriptionOptions = [
  { label: "All billing states", value: "all" },
  { label: "Admin granted", value: "admin_granted" },
  { label: "Subscribed", value: "subscribed" },
  { label: "Free trial", value: "trial" },
  { label: "Not subscribed", value: "free" },
  { label: "Billing issue", value: "billing_issue" },
] as const;

const pageSize = 10;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function daysBetween(first: Date, second: Date) {
  return Math.ceil((second.getTime() - first.getTime()) / 86_400_000);
}

function getTrialState(user: AdminUserRow) {
  if (!user.agentTrialUsedAt) return null;

  const startedAt = new Date(user.agentTrialUsedAt);
  const endsAt = new Date(startedAt.getTime() + 7 * 86_400_000);
  const daysRemaining = daysBetween(new Date(), endsAt);
  const day = Math.min(7, Math.max(1, 8 - Math.max(0, daysRemaining)));

  return {
    day,
    daysRemaining: Math.max(0, daysRemaining),
    endsAt,
    isActive: Date.now() < endsAt.getTime(),
  };
}

function hasActiveProOverride(user: AdminUserRow) {
  if (!user.proAccessOverrideEnabled) return false;
  if (!user.proAccessOverrideExpiresAt) return true;

  return new Date(user.proAccessOverrideExpiresAt).getTime() > Date.now();
}

function subscriptionState(user: AdminUserRow) {
  const trial = getTrialState(user);
  const status = user.activeSubscriptionStatus;

  if (hasActiveProOverride(user)) return "admin_granted";
  if (trial?.isActive) return "trial";
  if (status === "active") return "subscribed";
  if (status === "past_due" || status === "pending") return "billing_issue";

  return "free";
}

function subscriptionLabel(user: AdminUserRow) {
  const state = subscriptionState(user);
  const trial = getTrialState(user);

  if (state === "trial" && trial) {
    return `Trial day ${trial.day}/7`;
  }

  if (state === "admin_granted") return "Admin granted Pro";
  if (state === "subscribed") return "Subscribed";
  if (state === "billing_issue") return "Billing issue";

  return "Not subscribed";
}

function subscriptionTone(user: AdminUserRow): "default" | "muted" | "success" | "warning" {
  const state = subscriptionState(user);

  if (state === "subscribed" || state === "admin_granted") return "success";
  if (state === "trial") return "default";
  if (state === "billing_issue") return "warning";

  return "muted";
}

function formatLastOnline(value: string | null) {
  if (!value) return "Never seen";

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 5) return "Active now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) return `${diffHours}h ago`;

  return formatDateTime(value);
}

function initialsFromName(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "H"
  );
}

function UserAvatar({ user }: { user: AdminUserRow }) {
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Admin table uses stored media paths.
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="size-10 rounded-full border border-border object-cover"
      />
    );
  }

  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initialsFromName(user.name)}
    </span>
  );
}

function agencyTypeLabel(type: AdminUserRow["agencyType"]) {
  if (type === "network") return "Network HQ";
  if (type === "branch") return "Branch agency";
  if (type === "independent") return "Independent agency";
  return "Personal";
}

function agencyRoleLabel(role: AdminUserRow["agencyMemberRole"]) {
  if (role === "listing_manager") return "Listing manager";
  if (!role) return null;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function AccountSummary({ user }: { user: AdminUserRow }) {
  if (!user.agencyType || !user.agencyName) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
        <UserRound className="size-4" />
        Personal
      </span>
    );
  }

  const Icon = user.agencyType === "network" ? Network : Building2;

  return (
    <div className="min-w-0">
      <span className="inline-flex max-w-full items-center gap-1.5 font-bold">
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="truncate">{agencyTypeLabel(user.agencyType)}</span>
      </span>
      <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
        {user.agencyName}
      </p>
    </div>
  );
}

function StatusBadge({
  tone = "default",
  value,
}: {
  tone?: "default" | "muted" | "success" | "warning";
  value: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase",
        tone === "success"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : tone === "warning"
          ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
          : tone === "muted"
            ? "bg-secondary text-secondary-foreground"
            : "bg-primary/10 text-primary",
      )}
    >
      {value}
    </span>
  );
}

function EmptyValue() {
  return <span className="font-normal text-muted-foreground">Not set</span>;
}

function InfoSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      <dl className="mt-3 divide-y divide-border">{children}</dl>
    </section>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[10px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words font-semibold">
        {value || <EmptyValue />}
      </dd>
    </div>
  );
}

function dateInputValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function AdminProAccessOverrideForm({ user }: { user: AdminUserRow }) {
  const initialState: AdminProAccessOverrideState = { message: "", ok: true };
  const [state, formAction, isPending] = useActionState(
    updateAdminProAccessOverride,
    initialState,
  );
  const activeOverride = hasActiveProOverride(user);

  return (
    <form
      action={formAction}
      className="mt-5 rounded-lg border border-border bg-muted/20 p-4"
    >
      <input type="hidden" name="userId" value={user.id} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Crown className="size-4 text-primary" />
            Admin granted Pro
          </p>
          <p className="mt-1 max-w-xl text-xs font-normal leading-5 text-muted-foreground">
            Grants buyer-intent access without touching Stripe. This does not
            create a subscription, invoice, or payment method.
          </p>
        </div>
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold">
          <input
            name="enabled"
            type="checkbox"
            defaultChecked={activeOverride}
            className="size-4 accent-primary"
          />
          Pro enabled
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <label className="grid gap-1 text-xs font-semibold">
          Expires on
          <Input
            name="expiresAt"
            type="date"
            defaultValue={dateInputValue(user.proAccessOverrideExpiresAt)}
          />
          <span className="text-[11px] font-normal text-muted-foreground">
            Leave blank for no expiry.
          </span>
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Reason
          <Input
            name="reason"
            defaultValue={user.proAccessOverrideReason || ""}
            maxLength={240}
            placeholder="Demo access, partner account, internal QA..."
          />
          <span className="text-[11px] font-normal text-muted-foreground">
            Visible to admins only.
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={cn(
            "text-xs font-bold",
            state.message
              ? state.ok
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {state.message ||
            (activeOverride
              ? "This user currently has admin granted Pro access."
              : "This user does not have admin granted Pro access.")}
        </p>
        <Button type="submit" disabled={isPending} className="font-semibold">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save Pro access
        </Button>
      </div>
    </form>
  );
}

function AdminWorkspaceAccountTypeForm({ user }: { user: AdminUserRow }) {
  const initialState: AdminWorkspaceAccountTypeState = { message: "", ok: true };
  const [state, formAction, isPending] = useActionState(
    updateAdminWorkspaceAccountType,
    initialState,
  );

  if (!user.agencyId || user.agencyMemberRole !== "owner" || user.agencyType === "branch") {
    return null;
  }

  return (
    <form action={formAction} className="mt-5 rounded-lg border border-border bg-muted/20 p-4">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="agencyId" value={user.agencyId} />
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <UserRound className="size-4 text-primary" />
          Correct account type
        </p>
        <p className="mt-1 max-w-xl text-xs font-normal leading-5 text-muted-foreground">
          Conversions use the same dependency checks as the owner settings. They
          will not remove branches, people, listings, transfers, or configured billing.
        </p>
      </div>

      <label className="mt-4 grid gap-1 text-xs font-semibold">
        New account type
        <select
          name="targetType"
          defaultValue={user.agencyType === "network" ? "independent" : "personal"}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {user.agencyType === "network" ? (
            <option value="independent">Independent agency</option>
          ) : null}
          <option value="personal">Personal agent account</option>
        </select>
      </label>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={cn("text-xs font-bold", state.message ? (state.ok ? "text-emerald-700" : "text-destructive") : "text-muted-foreground")}>
          {state.message || "The server will check eligibility before making changes."}
        </p>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Change account type
        </Button>
      </div>
    </form>
  );
}

function AdminAgencyBillingTransitionForm({ user }: { user: AdminUserRow }) {
  const initialState: AdminAgencyBillingTransitionState = { message: "", ok: true };
  const [state, formAction, isPending] = useActionState(
    scheduleAdminAgencyBillingTransition,
    initialState,
  );

  if (
    !user.agencyId ||
    user.agencyType !== "independent" ||
    user.agencyMemberRole !== "owner" ||
    !["active", "past_due", "pending"].includes(user.activeSubscriptionStatus || "")
  ) {
    return null;
  }

  return (
    <form action={formAction} className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="agencyId" value={user.agencyId} />
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CreditCard className="size-4 text-amber-700 dark:text-amber-300" />
        Move personal billing to agency
      </p>
      <p className="mt-1 text-xs font-normal leading-5 text-muted-foreground">
        Schedules the personal Stripe subscription to end at its paid-through date.
        The owner becomes an agency-funded seat on that date, preventing double billing.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={cn("text-xs font-bold", state.message ? (state.ok ? "text-emerald-700" : "text-destructive") : "text-muted-foreground")}>
          {state.message || "Agency billing will take precedence after the paid personal period."}
        </p>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Schedule transition
        </Button>
      </div>
    </form>
  );
}

function UserDetailsDialog({
  onOpenChange,
  open,
  user,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  user: AdminUserRow | null;
}) {
  if (!user) return null;

  const profilePath = user.username ? `/users/${user.username}` : null;
  const trial = getTrialState(user);
  const proOverrideStatus = hasActiveProOverride(user)
    ? user.proAccessOverrideExpiresAt
      ? `Enabled until ${formatDateTime(user.proAccessOverrideExpiresAt)}`
      : "Enabled with no expiry"
    : user.proAccessOverrideEnabled
      ? "Expired"
      : "Not enabled";
  const trialStatus = trial
    ? `${trial.isActive ? "Active" : "Used"} · day ${trial.day}/7 · ends ${formatDateTime(trial.endsAt.toISOString())}`
    : "Not started";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] max-h-[88dvh] w-[min(94vw,48rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar user={user} />
              <div className="min-w-0">
                <Dialog.Title className="truncate text-lg font-semibold">
                  {user.name}
                </Dialog.Title>
                <Dialog.Description className="truncate text-sm font-normal text-muted-foreground">
                  {user.username ? `@${user.username}` : "No username"} · {user.email}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close user details">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="max-h-[calc(88dvh-5rem)] overflow-y-auto overscroll-contain px-5 py-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={user.role} />
              <StatusBadge
                value={user.status}
                tone={user.status === "disabled" ? "warning" : "default"}
              />
              <StatusBadge
                value={user.emailVerified ? "email verified" : "email unverified"}
                tone={user.emailVerified ? "default" : "muted"}
              />
              {user.agentProfileStatus ? (
                <StatusBadge value={`agent ${user.agentProfileStatus}`} />
              ) : null}
              {user.agencyType ? (
                <StatusBadge value={agencyTypeLabel(user.agencyType)} />
              ) : null}
              {user.agencyMemberRole ? (
                <StatusBadge value={`agency ${agencyRoleLabel(user.agencyMemberRole)}`} />
              ) : null}
              {user.activeSubscriptionStatus ? (
                <StatusBadge
                  value={subscriptionLabel(user)}
                  tone={subscriptionTone(user)}
                />
              ) : null}
              {hasActiveProOverride(user) ? (
                <StatusBadge value="admin granted Pro" tone="success" />
              ) : null}
            </div>

            {user.agencyId ? (
              <div className="mt-5 flex flex-col gap-3 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Agency support access</p>
                  <p className="mt-1 text-xs font-normal leading-5 text-muted-foreground">
                    Open {user.agencyName || "this agency"} as a Homzie admin
                    support session.
                  </p>
                </div>
                <form action={startAdminAgencySupportAction}>
                  <input type="hidden" name="agencyId" value={user.agencyId} />
                  <Button type="submit" className="w-full sm:w-auto">
                    <DoorOpen className="size-4" />
                    Open control room
                  </Button>
                </form>
              </div>
            ) : null}

            <div className="mt-5">
              <InfoSection title="Profile">
                <InfoRow label="User ID" value={user.id} />
                <InfoRow label="Display name" value={user.name} />
                <InfoRow
                  label="Username"
                  value={user.username ? `@${user.username}` : null}
                />
                <InfoRow label="Email" value={user.email} />
                <InfoRow label="Location" value={user.location} />
                <InfoRow label="Google place ID" value={user.locationPlaceId} />
                <InfoRow label="Bio" value={user.bio} />
              </InfoSection>

              <InfoSection title="Contact">
                <InfoRow label="Contact email" value={user.contactEmail} />
                <InfoRow label="Contact phone" value={user.contactPhone} />
                <InfoRow label="WhatsApp" value={user.whatsappNumber} />
                <InfoRow
                  label="Public contact"
                  value={user.publicContactVisible ? "Visible" : "Hidden"}
                />
              </InfoSection>

              <InfoSection title="Agency / Account">
                <InfoRow label="Account type" value={agencyTypeLabel(user.agencyType)} />
                <InfoRow label="Agency / Network" value={user.agencyName} />
                <InfoRow label="Agency ID" value={user.agencyId} />
                <InfoRow label="Agency slug" value={user.agencySlug} />
                <InfoRow
                  label="Agency role"
                  value={agencyRoleLabel(user.agencyMemberRole)}
                />
                <InfoRow label="Agency status" value={user.agencyStatus} />
                <InfoRow
                  label="Membership status"
                  value={user.agencyMemberStatus}
                />
              </InfoSection>

              <InfoSection title="Billing & Access">
                <InfoRow label="Subscription" value={subscriptionLabel(user)} />
                <InfoRow
                  label="Billing period"
                  value={
                    user.subscriptionCurrentPeriodEnd
                      ? `Until ${formatDateTime(user.subscriptionCurrentPeriodEnd)}`
                      : null
                  }
                />
                <InfoRow label="Trial" value={trialStatus} />
                <InfoRow label="Pro override" value={proOverrideStatus} />
                <InfoRow
                  label="Override reason"
                  value={user.proAccessOverrideReason}
                />
                <InfoRow
                  label="Override updated"
                  value={
                    user.proAccessOverrideUpdatedAt
                      ? formatDateTime(user.proAccessOverrideUpdatedAt)
                      : null
                  }
                />
              </InfoSection>

              <InfoSection title="Activity">
                <InfoRow
                  label="Last online"
                  value={formatLastOnline(user.lastOnlineAt)}
                />
                <InfoRow
                  label="Listings"
                  value={user.listingCount.toLocaleString("en-ZA")}
                />
                <InfoRow
                  label="Reels"
                  value={user.reelCount.toLocaleString("en-ZA")}
                />
                <InfoRow label="Created" value={formatDateTime(user.createdAt)} />
                <InfoRow label="Updated" value={formatDateTime(user.updatedAt)} />
              </InfoSection>
            </div>

            <AdminProAccessOverrideForm user={user} />
            <AdminWorkspaceAccountTypeForm user={user} />
            <AdminAgencyBillingTransitionForm user={user} />

            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-normal text-muted-foreground">
                Profile actions are intentionally light for this first pass.
              </p>
              {profilePath ? (
                <Button asChild>
                  <Link href={profilePath} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    Open profile
                  </Link>
                </Button>
              ) : (
                <Button disabled>
                  <ExternalLink className="size-4" />
                  No profile
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FilterRadioItem({
  children,
  value,
}: {
  children: ReactNode;
  value: string;
}) {
  return (
    <DropdownMenu.RadioItem
      value={value}
      className="flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm font-bold outline-none transition-colors focus:bg-accent data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary"
    >
      {children}
    </DropdownMenu.RadioItem>
  );
}

function IncompleteTrialAuditButton() {
  const [state, formAction, isPending] = useActionState(
    async () => auditIncompleteTrialsAction(),
    { message: "", ok: true },
  );

  return (
    <div className="flex flex-col gap-2 lg:items-end">
      <form action={formAction}>
        <Button
          type="submit"
          variant="outline"
          className="font-semibold"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          Audit incomplete trials
        </Button>
      </form>
      {state.message ? (
        <p
          className={cn(
            "max-w-sm text-xs font-bold",
            state.ok ? "text-emerald-700" : "text-destructive",
          )}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]["value"]>("all");
  const [accountType, setAccountType] =
    useState<(typeof accountTypeOptions)[number]["value"]>("all");
  const [status, setStatus] =
    useState<(typeof statusOptions)[number]["value"]>("all");
  const [subscription, setSubscription] =
    useState<(typeof subscriptionOptions)[number]["value"]>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.username?.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery) ||
        user.agencyName?.toLowerCase().includes(normalizedQuery);
      const matchesRole = role === "all" || user.role === role;
      const matchesAccountType =
        accountType === "all" ||
        (accountType === "personal" && !user.agencyType) ||
        user.agencyType === accountType;
      const matchesStatus = status === "all" || user.status === status;
      const matchesSubscription =
        subscription === "all" || subscriptionState(user) === subscription;

      return (
        matchesQuery &&
        matchesRole &&
        matchesAccountType &&
        matchesStatus &&
        matchesSubscription
      );
    });
  }, [accountType, query, role, status, subscription, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  );
  const activeFilterCount = [role, status, accountType, subscription].filter(
    (value) => value !== "all",
  ).length;

  return (
    <>
      <section className="mt-8 rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative">
              <span className="sr-only">Search users</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search by display name, username, or email"
                className="pl-9 lg:w-[32rem]"
              />
            </label>

            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <Button type="button" variant="outline" className="gap-2 font-semibold">
                  <SlidersHorizontal className="size-4" />
                  Filters
                  {activeFilterCount ? (
                    <span className="grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-[80] grid w-72 gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl"
                >
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <Filter className="size-4 text-primary" />
                    <p className="text-sm font-semibold">Filter users</p>
                  </div>

                  <div>
                    <p className="mb-1 px-2 text-[10px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                      Subscription
                    </p>
                    <DropdownMenu.RadioGroup
                      value={subscription}
                      onValueChange={(value) =>
                        setSubscription(value as typeof subscription)
                      }
                    >
                      {subscriptionOptions.map((option) => (
                        <FilterRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </FilterRadioItem>
                      ))}
                    </DropdownMenu.RadioGroup>
                  </div>

                  <div>
                    <p className="mb-1 px-2 text-[10px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                      Role
                    </p>
                    <DropdownMenu.RadioGroup
                      value={role}
                      onValueChange={(value) => setRole(value as typeof role)}
                    >
                      {roleOptions.map((option) => (
                        <FilterRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </FilterRadioItem>
                      ))}
                    </DropdownMenu.RadioGroup>
                  </div>

                  <div>
                    <p className="mb-1 px-2 text-[10px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                      Account
                    </p>
                    <DropdownMenu.RadioGroup
                      value={accountType}
                      onValueChange={(value) =>
                        setAccountType(value as typeof accountType)
                      }
                    >
                      {accountTypeOptions.map((option) => (
                        <FilterRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </FilterRadioItem>
                      ))}
                    </DropdownMenu.RadioGroup>
                  </div>

                  <div>
                    <p className="mb-1 px-2 text-[10px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                      Status
                    </p>
                    <DropdownMenu.RadioGroup
                      value={status}
                      onValueChange={(value) => setStatus(value as typeof status)}
                    >
                      {statusOptions.map((option) => (
                        <FilterRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </FilterRadioItem>
                      ))}
                    </DropdownMenu.RadioGroup>
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery("");
                setRole("all");
                setAccountType("all");
                setStatus("all");
                setSubscription("all");
              }}
            >
              Reset
            </Button>
            <div className="lg:ml-auto">
              <IncompleteTrialAuditButton />
            </div>
          </div>
          <p className="mt-3 text-xs font-normal text-muted-foreground">
            Showing {filteredUsers.length.toLocaleString("en-ZA")} of{" "}
            {users.length.toLocaleString("en-ZA")} users.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-max min-w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Subscription</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Last online</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedUsers.map((user) => (
                <tr
                  key={user.id}
                  className="cursor-pointer transition-colors hover:bg-accent/40"
                  onClick={() => setSelectedUser(user)}
                >
                  <td className="px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={user} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{user.name}</p>
                        <p className="truncate text-xs font-normal text-muted-foreground">
                          {user.username ? `@${user.username}` : "No username"} ·{" "}
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      {user.role === "admin" ? (
                        <ShieldCheck className="size-4 text-primary" />
                      ) : (
                        <UserRound className="size-4 text-muted-foreground" />
                      )}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <AccountSummary user={user} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge
                        value={subscriptionLabel(user)}
                        tone={subscriptionTone(user)}
                      />
                      {hasActiveProOverride(user) &&
                      user.proAccessOverrideExpiresAt ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          Until {formatDateTime(user.proAccessOverrideExpiresAt)}
                        </span>
                      ) : getTrialState(user)?.isActive ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          {getTrialState(user)?.daysRemaining} days left
                        </span>
                      ) : user.subscriptionCurrentPeriodEnd ? (
                        <span className="text-xs font-normal text-muted-foreground">
                          Until {formatDateTime(user.subscriptionCurrentPeriodEnd)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-nowrap gap-1.5">
                      <StatusBadge
                        value={user.status}
                        tone={user.status === "disabled" ? "warning" : "default"}
                      />
                      {user.emailVerified ? (
                        <span title="Email verified">
                          <BadgeCheck className="size-4 text-primary" />
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs font-normal text-muted-foreground">
                    {user.listingCount.toLocaleString("en-ZA")} listings ·{" "}
                    {user.reelCount.toLocaleString("en-ZA")} reels
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                      <Clock3 className="size-4" />
                      {formatLastOnline(user.lastOnlineAt)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                      <CalendarDays className="size-4" />
                      {formatDateTime(user.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredUsers.length ? (
          <div className="px-4 py-10 text-center text-sm font-normal text-muted-foreground">
            No users match those filters.
          </div>
        ) : null}

        {filteredUsers.length ? (
          <div className="border-t border-border px-4 pb-5">
            <Pagination
              currentPage={safeCurrentPage}
              onPageChange={setCurrentPage}
              totalPages={totalPages}
            />
          </div>
        ) : null}
      </section>

      <UserDetailsDialog
        open={Boolean(selectedUser)}
        user={selectedUser}
        onOpenChange={(open) => {
          if (!open) setSelectedUser(null);
        }}
      />
    </>
  );
}

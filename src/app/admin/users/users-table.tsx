"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BadgeCheck,
  CalendarDays,
  ExternalLink,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">
      {initialsFromName(user.name)}
    </span>
  );
}

function StatusBadge({
  tone = "default",
  value,
}: {
  tone?: "default" | "muted" | "warning";
  value: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-black uppercase",
        tone === "warning"
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

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-bold">{value || "Not set"}</div>
    </div>
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] max-h-[88dvh] w-[min(94vw,48rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar user={user} />
              <div className="min-w-0">
                <Dialog.Title className="truncate text-lg font-black">
                  {user.name}
                </Dialog.Title>
                <Dialog.Description className="truncate text-sm font-semibold text-muted-foreground">
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
              {user.activeSubscriptionStatus ? (
                <StatusBadge value={`subscription ${user.activeSubscriptionStatus}`} />
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <DetailItem label="User ID" value={user.id} />
              <DetailItem label="Display name" value={user.name} />
              <DetailItem label="Username" value={user.username ? `@${user.username}` : null} />
              <DetailItem label="Email" value={user.email} />
              <DetailItem label="Contact email" value={user.contactEmail} />
              <DetailItem label="Contact phone" value={user.contactPhone} />
              <DetailItem label="WhatsApp" value={user.whatsappNumber} />
              <DetailItem label="Location" value={user.location} />
              <DetailItem label="Google place ID" value={user.locationPlaceId} />
              <DetailItem
                label="Public contact"
                value={user.publicContactVisible ? "Visible" : "Hidden"}
              />
              <DetailItem label="Listings" value={user.listingCount.toLocaleString("en-ZA")} />
              <DetailItem label="Reels" value={user.reelCount.toLocaleString("en-ZA")} />
              <DetailItem label="Created" value={formatDateTime(user.createdAt)} />
              <DetailItem label="Updated" value={formatDateTime(user.updatedAt)} />
            </div>

            <div className="mt-3">
              <DetailItem label="Bio" value={user.bio} />
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-muted-foreground">
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

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]["value"]>("all");
  const [status, setStatus] =
    useState<(typeof statusOptions)[number]["value"]>("all");
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.username?.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery);
      const matchesRole = role === "all" || user.role === role;
      const matchesStatus = status === "all" || user.status === status;

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [query, role, status, users]);

  return (
    <>
      <section className="mt-8 rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] lg:items-center">
            <label className="relative">
              <span className="sr-only">Search users</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search by display name, username, or email"
                className="pl-9"
              />
            </label>
            <select
              value={role}
              onChange={(event) =>
                setRole(event.currentTarget.value as typeof role)
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label="Filter by role"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.currentTarget.value as typeof status)
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label="Filter by status"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery("");
                setRole("all");
                setStatus("all");
              }}
            >
              Reset
            </Button>
          </div>
          <p className="mt-3 text-xs font-bold text-muted-foreground">
            Showing {filteredUsers.length.toLocaleString("en-ZA")} of{" "}
            {users.length.toLocaleString("en-ZA")} users.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="cursor-pointer transition-colors hover:bg-accent/40"
                  onClick={() => setSelectedUser(user)}
                >
                  <td className="px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={user} />
                      <div className="min-w-0">
                        <p className="truncate font-black">{user.name}</p>
                        <p className="truncate text-xs font-semibold text-muted-foreground">
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
                    <div className="flex flex-wrap gap-1.5">
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
                  <td className="px-4 py-4 text-xs font-bold text-muted-foreground">
                    {user.listingCount.toLocaleString("en-ZA")} listings ·{" "}
                    {user.reelCount.toLocaleString("en-ZA")} reels
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
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
          <div className="px-4 py-10 text-center text-sm font-semibold text-muted-foreground">
            No users match those filters.
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

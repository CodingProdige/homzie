import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Archive, Bell, CheckCheck, Clock, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { sql } from "@/db";
import {
  archiveAgencyActivityAction,
  markAgencyActivityReadAction,
  markAllAgencyActivityReadAction,
} from "@/modules/agencies/activity-actions";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import { getPrimaryAgencyWorkspace } from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control Room Activity | Homzie",
  description: "Review operational events, requests, and action items for your control room.",
};

type ActivityPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
};

type ActivityRow = {
  action_href: string | null;
  action_label: string | null;
  actor_agency_name: string | null;
  archived_at: Date | null;
  body: string;
  created_at: Date | string;
  event_type: string;
  id: string;
  read_at: Date | null;
  severity: "action_required" | "info" | "success" | "warning" | string;
  title: string;
};

function relativeTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "recently";

  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function severityClasses(severity: ActivityRow["severity"]) {
  if (severity === "action_required") {
    return "bg-red-500/10 text-red-600";
  }

  if (severity === "success") {
    return "bg-emerald-500/10 text-emerald-700";
  }

  if (severity === "warning") {
    return "bg-amber-500/10 text-amber-700";
  }

  return "bg-primary/10 text-primary";
}

function severityLabel(severity: ActivityRow["severity"]) {
  if (severity === "action_required") return "Action required";

  return severity.replaceAll("_", " ");
}

export default async function ControlRoomActivityPage({ params }: ActivityPageProps) {
  const [{ workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) redirect("/controlroom");
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/controlroom/${kind}/activity`);

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace) redirect(`/controlroom/${kind}`);
  if (controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(`${controlRoomPathForWorkspace(workspace)}/activity`);
  }

  const rows = await sql<ActivityRow[]>`
    SELECT
      aae.id,
      aae.event_type,
      aae.title,
      aae.body,
      aae.action_label,
      aae.action_href,
      aae.severity,
      aae.read_at,
      aae.archived_at,
      aae.created_at,
      actor.name AS actor_agency_name
    FROM agency_activity_events aae
    LEFT JOIN agencies actor ON actor.id = aae.actor_agency_id
    WHERE aae.agency_id = ${workspace.agency.id}
      AND aae.archived_at IS NULL
    ORDER BY
      CASE WHEN aae.read_at IS NULL THEN 0 ELSE 1 END,
      CASE aae.severity WHEN 'action_required' THEN 0 ELSE 1 END,
      aae.created_at DESC
    LIMIT 80
  `;
  const unreadCount = rows.filter((row) => !row.read_at).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Control room
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Activity
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
            Operational requests, decisions, and action items for {workspace.agency.name}.
          </p>
        </div>

        {rows.length ? (
          <form action={markAllAgencyActivityReadAction}>
            <Button type="submit" variant="outline">
              <CheckCheck className="size-4" />
              Clear all
            </Button>
          </form>
        ) : null}
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Control room activity</h2>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-normal uppercase text-muted-foreground">
            {unreadCount} unread
          </span>
        </div>

        {rows.length ? (
          <div className="divide-y divide-border">
            {rows.map((row) => {
              const actionHref = row.action_href || null;

              return (
                <article
                  key={row.id}
                  className={cn(
                    "grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto]",
                    !row.read_at && "bg-primary/5",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {!row.read_at ? (
                        <span className="size-2 rounded-full bg-red-500" aria-label="Unread" />
                      ) : null}
                      <h3 className="min-w-0 truncate text-sm font-semibold">
                        {row.title}
                      </h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[10px] font-semibold uppercase",
                          severityClasses(row.severity),
                        )}
                      >
                        {severityLabel(row.severity)}
                      </span>
                    </div>
                    <p className="mt-2 max-w-3xl text-sm font-normal leading-6 text-muted-foreground">
                      {row.body}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-normal text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {relativeTime(row.created_at)}
                      </span>
                      {row.actor_agency_name ? <span>{row.actor_agency_name}</span> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {actionHref ? (
                      <Button asChild size="sm" variant={row.severity === "action_required" ? "default" : "outline"}>
                        <Link href={actionHref}>
                          {row.action_label || "Open"}
                          <ExternalLink className="size-4" />
                        </Link>
                      </Button>
                    ) : null}
                    {!row.read_at ? (
                      <form action={markAgencyActivityReadAction}>
                        <input type="hidden" name="eventId" value={row.id} />
                        <Button type="submit" size="sm" variant="outline">
                          <CheckCheck className="size-4" />
                          Read
                        </Button>
                      </form>
                    ) : null}
                    <form action={archiveAgencyActivityAction}>
                      <input type="hidden" name="eventId" value={row.id} />
                      <Button type="submit" size="sm" variant="ghost">
                        <Archive className="size-4" />
                        <span className="sr-only">Archive</span>
                      </Button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-10 text-sm font-normal text-muted-foreground">
            No control room activity yet.
          </div>
        )}
      </section>
    </main>
  );
}

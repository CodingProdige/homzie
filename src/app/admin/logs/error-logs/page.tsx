import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertOctagon,
  CheckCircle2,
  Clock3,
  ListFilter,
  Pin,
} from "lucide-react";

import {
  CanonicalTable,
  type CanonicalTableColumn,
} from "@/components/ui/canonical-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sql } from "@/db";
import { markAllErrorLogsReadAction } from "./actions";
import { ErrorLogRowActions } from "./error-log-row-actions";

export const metadata: Metadata = {
  title: "Error Logs | Homzie Admin",
  description: "Inspect server and client error logs captured by Homzie.",
};

const pageSize = 20;
const filters = [
  { label: "Unread", value: "unread" },
  { label: "Pinned", value: "pinned" },
  { label: "All", value: "all" },
] as const;

type ErrorLogFilter = (typeof filters)[number]["value"];

type ErrorLogCounts = {
  last_24h_count: number | string | null;
  pinned_count: number | string | null;
  total_count: number | string | null;
  unread_count: number | string | null;
};

type ErrorLogRow = {
  action: string | null;
  created_at: string;
  digest: string | null;
  id: string;
  listing_id: string | null;
  listing_title: string | null;
  message: string;
  metadata: unknown;
  pinned: boolean;
  read_at: string | null;
  route: string | null;
  severity: string;
  source: string;
  stack: string | null;
  stage: string | null;
  status: string;
  user_email: string | null;
  user_id: string | null;
  user_name: string | null;
  user_username: string | null;
  username: string | null;
};

type AdminErrorLogsPageProps = {
  searchParams?: Promise<{ filter?: string; page?: string }>;
};

function positivePage(value: unknown) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function countFrom(value: number | string | null | undefined) {
  return Number(value || 0);
}

function formatNumber(value: number | string | null | undefined) {
  return countFrom(value).toLocaleString("en-ZA");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function humanize(value: string | null | undefined) {
  if (!value) return "Not set";

  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function badge(value: string, tone: "critical" | "warning" | "default" | "muted") {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
        tone === "critical"
          ? "bg-red-500/12 text-red-700 dark:text-red-300"
          : tone === "warning"
            ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
            : tone === "default"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

function severityTone(severity: string): "critical" | "warning" | "default" | "muted" {
  if (severity === "critical" || severity === "error") return "critical";
  if (severity === "warning") return "warning";
  if (severity === "info") return "default";

  return "muted";
}

function stackPreview(stack: string | null) {
  if (!stack) return null;

  return stack.length > 1800 ? `${stack.slice(0, 1800)}...` : stack;
}

function stringifyMetadata(metadata: unknown) {
  try {
    return JSON.stringify(metadata || {}, null, 2);
  } catch {
    return "{}";
  }
}

function copyPayload(row: ErrorLogRow) {
  return JSON.stringify(
    {
      action: row.action,
      createdAt: row.created_at,
      digest: row.digest,
      id: row.id,
      listing: {
        id: row.listing_id,
        title: row.listing_title,
      },
      message: row.message,
      metadata: row.metadata || {},
      route: row.route,
      severity: row.severity,
      source: row.source,
      stack: row.stack,
      stage: row.stage,
      status: row.status,
      user: {
        email: row.user_email,
        id: row.user_id,
        name: row.user_name,
        username: row.user_username || row.username,
      },
    },
    null,
    2,
  );
}

function filterHref(filter: ErrorLogFilter) {
  return `/admin/logs/error-logs?filter=${filter}`;
}

async function getErrorLogCounts() {
  const [counts] = await sql<ErrorLogCounts[]>`
    SELECT
      count(*) AS total_count,
      count(*) FILTER (WHERE status = 'unread') AS unread_count,
      count(*) FILTER (WHERE pinned = true) AS pinned_count,
      count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS last_24h_count
    FROM error_logs
  `;

  return counts || {
    last_24h_count: 0,
    pinned_count: 0,
    total_count: 0,
    unread_count: 0,
  };
}

async function getErrorLogs(filter: ErrorLogFilter) {
  const whereClause =
    filter === "unread"
      ? sql`WHERE el.status = 'unread'`
      : filter === "pinned"
        ? sql`WHERE el.pinned = true`
        : sql``;

  return sql<ErrorLogRow[]>`
    SELECT
      el.id::text,
      el.source,
      el.route,
      el.action,
      el.stage,
      el.severity,
      el.status,
      el.pinned,
      el.user_id::text,
      el.username,
      el.listing_id::text,
      el.message,
      el.digest,
      el.stack,
      el.metadata,
      el.read_at::text,
      el.created_at::text,
      u.name AS user_name,
      u.username AS user_username,
      u.email AS user_email,
      pl.title AS listing_title
    FROM error_logs el
    LEFT JOIN users u ON u.id = el.user_id
    LEFT JOIN property_listings pl ON pl.id = el.listing_id
    ${whereClause}
    ORDER BY el.pinned DESC, el.created_at DESC
    LIMIT 200
  `;
}

const columns: Array<CanonicalTableColumn<ErrorLogRow>> = [
  {
    header: "Error",
    key: "error",
    render: (row) => (
      <div className="max-w-2xl">
        <div className="flex flex-wrap gap-1.5">
          {badge(row.status === "unread" ? "Unread" : "Read", row.status === "unread" ? "warning" : "muted")}
          {badge(humanize(row.severity), severityTone(row.severity))}
          {row.pinned ? badge("Pinned", "default") : null}
        </div>
        <p className="mt-2 font-semibold leading-6">{row.message}</p>
        <p className="mt-1 line-clamp-1 text-xs font-normal text-muted-foreground">
          {[humanize(row.source), humanize(row.action), humanize(row.stage)]
            .filter((value) => value !== "Not set")
            .join(" / ") || "No action context"}
        </p>
        <details className="mt-3 text-xs font-normal text-muted-foreground">
          <summary className="cursor-pointer font-semibold text-foreground">
            Stack and metadata
          </summary>
          {row.digest ? (
            <p className="mt-3 rounded-md bg-muted px-3 py-2 font-mono text-[11px]">
              digest: {row.digest}
            </p>
          ) : null}
          {row.stack ? (
            <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-5 text-muted-foreground">
              {stackPreview(row.stack)}
            </pre>
          ) : null}
          <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] leading-5 text-muted-foreground">
            {stringifyMetadata(row.metadata)}
          </pre>
        </details>
      </div>
    ),
  },
  {
    header: "Context",
    key: "context",
    render: (row) => {
      const username = row.user_username || row.username;

      return (
        <div className="min-w-56 text-xs font-normal leading-5 text-muted-foreground">
          <p>
            User:{" "}
            <span className="font-bold text-foreground">
              {username ? `@${username}` : row.user_name || "Unknown"}
            </span>
          </p>
          {row.user_email ? <p className="truncate">{row.user_email}</p> : null}
          {row.listing_id ? (
            <p className="mt-2">
              Listing:{" "}
              <Link
                className="font-bold text-primary hover:underline"
                href={`/listings/${row.listing_id}/edit`}
              >
                {row.listing_title || row.listing_id.slice(0, 8)}
              </Link>
            </p>
          ) : null}
          {row.route ? <p className="mt-2 font-mono text-[11px]">{row.route}</p> : null}
        </div>
      );
    },
  },
  {
    header: "Created",
    key: "created",
    render: (row) => (
      <div className="min-w-36 text-xs font-normal leading-5 text-muted-foreground">
        <p className="font-semibold text-foreground">{formatDateTime(row.created_at)}</p>
        {row.read_at ? <p>Read {formatDateTime(row.read_at)}</p> : null}
      </div>
    ),
  },
  {
    className: "w-72",
    header: "Actions",
    key: "actions",
    render: (row) => (
      <ErrorLogRowActions
        copyPayload={copyPayload(row)}
        errorLogId={row.id}
        isPinned={row.pinned}
        isRead={row.status === "read"}
      />
    ),
    sticky: "right",
    useRowHref: false,
  },
];

function MetricCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: typeof AlertOctagon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {label}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs font-normal leading-5 text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

export default async function AdminErrorLogsPage({
  searchParams,
}: AdminErrorLogsPageProps) {
  const query = searchParams ? await searchParams : {};
  const currentFilter = filters.some((filter) => filter.value === query.filter)
    ? (query.filter as ErrorLogFilter)
    : "unread";
  const currentPage = positivePage(query.page);
  const [counts, rows] = await Promise.all([
    getErrorLogCounts(),
    getErrorLogs(currentFilter),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Admin / Logs
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Error logs
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
            Review unexpected server, route, action, and error-boundary
            failures captured across Homzie.
          </p>
        </div>
        <form action={markAllErrorLogsReadAction}>
          <Button type="submit" variant="outline">
            <CheckCircle2 className="size-4" />
            Mark unread as read
          </Button>
        </form>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard
          detail="Needs admin attention."
          icon={AlertOctagon}
          label="Unread"
          value={formatNumber(counts.unread_count)}
        />
        <MetricCard
          detail="Pinned for follow-up."
          icon={Pin}
          label="Pinned"
          value={formatNumber(counts.pinned_count)}
        />
        <MetricCard
          detail="Captured in the last day."
          icon={Clock3}
          label="Last 24h"
          value={formatNumber(counts.last_24h_count)}
        />
      </section>

      <section className="mt-8 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Link
              key={filter.value}
              href={filterHref(filter.value)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold transition",
                currentFilter === filter.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.value === "unread" ? <ListFilter className="size-4" /> : null}
              {filter.label}
            </Link>
          ))}
          <span className="ml-auto inline-flex items-center rounded-md border border-border bg-background px-3 text-sm font-normal text-muted-foreground">
            {formatNumber(rows.length)} shown / {formatNumber(counts.total_count)} total
          </span>
        </div>
      </section>

      <section className="mt-6">
        <CanonicalTable
          columns={columns}
          emptyState="No error logs in this queue."
          getRowKey={(row) => row.id}
          minWidth="1040px"
          pagination={{
            currentPage,
            hrefForPage: (page) =>
              `/admin/logs/error-logs?filter=${currentFilter}&page=${page}`,
            pageSize,
            totalItems: rows.length,
          }}
          rows={rows}
        />
      </section>
    </main>
  );
}

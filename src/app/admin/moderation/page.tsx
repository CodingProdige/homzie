import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";

import {
  CanonicalTable,
  type CanonicalTableColumn,
} from "@/components/ui/canonical-table";
import { cn } from "@/lib/utils";
import {
  getModerationRows,
  isOpenModerationStatus,
  sourceLabel,
  statusLabel,
  type ModerationRow,
} from "./moderation-data";

export const metadata: Metadata = {
  title: "Moderation | Homzie Admin",
  description: "Review reports, sale claims, and disputes on Homzie.",
};

const pageSize = 12;

type AdminModerationPageProps = {
  searchParams?: Promise<{ page?: string; type?: string }>;
};

const tabs = [
  { label: "Open", value: "open" },
  { label: "Reports", value: "reports" },
  { label: "Sale claims", value: "sale_claims" },
  { label: "Disputes", value: "disputes" },
  { label: "All", value: "all" },
];

function positivePage(value: unknown) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function badge(value: string, tone: "default" | "warning" | "muted" = "muted") {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]",
        tone === "warning"
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

function filterRows(rows: ModerationRow[], type: string) {
  if (type === "reports") {
    return rows.filter((row) => row.source === "case" || row.source === "message_report");
  }

  if (type === "sale_claims") {
    return rows.filter((row) => row.source === "sale_claim");
  }

  if (type === "disputes") {
    return rows.filter((row) => row.source === "sale_dispute");
  }

  if (type === "all") return rows;

  return rows.filter(isOpenModerationStatus);
}

const columns: Array<CanonicalTableColumn<ModerationRow>> = [
  {
    header: "Case",
    key: "case",
    render: (row) => (
      <div>
        <div className="flex flex-wrap gap-1.5">
          {badge(sourceLabel(row.source), "default")}
          {badge(statusLabel(row.status), isOpenModerationStatus(row) ? "warning" : "muted")}
        </div>
        <p className="mt-2 font-black">{row.content_title || row.target_type}</p>
        <p className="mt-1 line-clamp-1 text-xs font-semibold text-muted-foreground">
          {row.reason || "No reason supplied"}
        </p>
      </div>
    ),
  },
  {
    header: "People",
    key: "people",
    render: (row) => (
      <div className="text-xs font-semibold leading-5 text-muted-foreground">
        <p>
          Reporter:{" "}
          <span className="font-bold text-foreground">
            {row.reporter_name || row.reporter_email || "System"}
          </span>
        </p>
        <p>
          Target:{" "}
          <span className="font-bold text-foreground">
            {row.target_name || "Not linked"}
          </span>
        </p>
      </div>
    ),
  },
  {
    header: "Priority",
    key: "priority",
    render: (row) =>
      badge(row.priority, ["high", "urgent"].includes(row.priority) ? "warning" : "muted"),
  },
  {
    header: "Created",
    key: "created",
    render: (row) => (
      <span className="text-xs font-bold text-muted-foreground">
        {formatDate(row.created_at)}
      </span>
    ),
  },
];

export default async function AdminModerationPage({
  searchParams,
}: AdminModerationPageProps) {
  const query = searchParams ? await searchParams : {};
  const currentType = tabs.some((tab) => tab.value === query.type)
    ? String(query.type)
    : "open";
  const currentPage = positivePage(query.page);
  const rows = filterRows(await getModerationRows(), currentType);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Moderation
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
            Review reports, sale claims, disputes, and safety signals before
            they affect public trust surfaces.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-bold text-muted-foreground">
          {rows.length.toLocaleString("en-ZA")} {rows.length === 1 ? "item" : "items"}
        </div>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.value}
              href={`/admin/moderation?type=${tab.value}`}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-black transition",
                currentType === tab.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.value === "open" ? <AlertTriangle className="size-4" /> : null}
              {tab.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <CanonicalTable
          columns={columns}
          emptyState="No moderation items in this queue."
          getRowHref={(row) => `/admin/moderation/${row.source}/${row.id}`}
          getRowKey={(row) => `${row.source}-${row.id}`}
          pagination={{
            currentPage,
            hrefForPage: (page) => `/admin/moderation?type=${currentType}&page=${page}`,
            pageSize,
            totalItems: rows.length,
          }}
          rows={rows}
        />
      </section>

      <p className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
        Open items include in-review, waiting, pending, and escalated records.
        <ChevronRight className="size-3" />
      </p>
    </main>
  );
}

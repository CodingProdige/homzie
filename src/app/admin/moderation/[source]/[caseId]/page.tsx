import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getModerationRow,
  isOpenModerationStatus,
  sourceLabel,
  statusLabel,
} from "../../moderation-data";
import { ModerationReviewForm } from "../../moderation-review-form";

export const metadata: Metadata = {
  title: "Moderation Details | Homzie Admin",
  description: "Review a Homzie moderation item.",
};

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
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
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

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[10px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-bold">{value || "Not set"}</div>
    </div>
  );
}

export default async function AdminModerationDetailsPage({
  params,
}: {
  params: Promise<{ caseId: string; source: string }>;
}) {
  const { caseId, source } = await params;
  const row = await getModerationRow(source, caseId);

  if (!row) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <BackButton href="/admin/moderation" label="Moderation" className="mb-6" />

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              {badge(sourceLabel(row.source), "default")}
              {badge(statusLabel(row.status), isOpenModerationStatus(row) ? "warning" : "muted")}
              {badge(row.priority)}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {row.content_title || sourceLabel(row.source)}
            </h1>
            <p className="mt-2 text-sm font-normal leading-7 text-muted-foreground">
              Review the submitted signal, update its status, and keep the
              dashboard moderation counts honest.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/moderation">
              Queue
              <ExternalLink className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <DetailItem label="Source" value={sourceLabel(row.source)} />
          <DetailItem label="Target type" value={row.target_type} />
          <DetailItem label="Reporter" value={row.reporter_name || row.reporter_email || "System"} />
          <DetailItem label="Target user" value={row.target_name} />
          <DetailItem label="Created" value={formatDate(row.created_at)} />
          <DetailItem label="Updated" value={formatDate(row.updated_at)} />
        </div>

        <div className="mt-3 grid gap-3">
          <DetailItem label="Reason" value={row.reason} />
          <DetailItem label="Details / evidence summary" value={row.details} />
          <DetailItem label="Record ID" value={`${row.source}:${row.id}`} />
        </div>
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Review decision</h2>
        <p className="mt-1 text-sm font-normal text-muted-foreground">
          Status changes update the underlying moderation source and the admin
          dashboard counts.
        </p>
        <div className="mt-5">
          <ModerationReviewForm row={row} />
        </div>
      </section>
    </main>
  );
}

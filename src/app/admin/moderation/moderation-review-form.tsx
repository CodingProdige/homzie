"use client";

import { useActionState } from "react";

import {
  updateAdminModerationItem,
  type AdminModerationUpdateState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  disputeStatusOptions,
  moderationPriorityOptions,
  moderationStatusOptions,
  saleClaimStatusOptions,
  type ModerationRow,
} from "./moderation-data";

const initialState: AdminModerationUpdateState = {
  message: "",
  ok: false,
};

function optionsForSource(source: ModerationRow["source"]) {
  if (source === "sale_claim") return saleClaimStatusOptions;
  if (source === "sale_dispute") return disputeStatusOptions;
  return moderationStatusOptions;
}

export function ModerationReviewForm({ row }: { row: ModerationRow }) {
  const [state, action, pending] = useActionState(
    updateAdminModerationItem,
    initialState,
  );

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="source" value={row.source} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-black">
          Status
          <select
            name="status"
            defaultValue={row.status}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
          >
            {optionsForSource(row.source).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-black">
          Priority
          <select
            name="priority"
            defaultValue={row.priority}
            disabled={row.source !== "case"}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {moderationPriorityOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-sm font-black">
        Admin notes
        <textarea
          name="adminNotes"
          defaultValue=""
          disabled={row.source !== "case"}
          placeholder={
            row.source === "case"
              ? "Record what was checked and why the decision was made."
              : "Notes are currently available on native Homzie moderation cases."
          }
          className="min-h-32 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>

      {state.message ? (
        <p
          className={
            state.ok
              ? "rounded-md bg-primary/10 px-3 py-2 text-sm font-bold text-primary"
              : "rounded-md bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive"
          }
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save moderation review"}
      </Button>
    </form>
  );
}

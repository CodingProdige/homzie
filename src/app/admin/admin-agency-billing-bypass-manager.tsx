"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Building2, CreditCard, Power, Save, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  updateAdminAgencySeatBillingBypass,
  type AdminAgencyBillingBypassState,
} from "./actions";

export type AdminAgencyBillingBypassAgencyView = {
  agencyType: "branch" | "independent";
  billingBypassEnabled: boolean;
  billingBypassReason: string | null;
  billingBypassUpdatedAt: string | null;
  billingBypassUpdatedByName: string | null;
  billingConfigured: boolean;
  billingProfileStatus: string | null;
  currentSeats: number;
  id: string;
  name: string;
  paymentMethodLabel: string | null;
  region: string | null;
  slug: string;
  status: "active" | "pending" | "suspended";
};

const initialState: AdminAgencyBillingBypassState = {
  message: "",
  ok: false,
};

function agencyTypeLabel(type: AdminAgencyBillingBypassAgencyView["agencyType"]) {
  return type === "branch" ? "Branch agency" : "Independent agency";
}

function updatedLabel(agency: AdminAgencyBillingBypassAgencyView) {
  if (!agency.billingBypassUpdatedAt) return null;

  const date = new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(agency.billingBypassUpdatedAt));

  return agency.billingBypassUpdatedByName
    ? `Updated ${date} by ${agency.billingBypassUpdatedByName}`
    : `Updated ${date}`;
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" disabled={pending} className="h-10">
      <Save className="size-4" />
      {pending ? "Saving..." : "Save"}
    </Button>
  );
}

function BillingBypassRow({
  agency,
}: {
  agency: AdminAgencyBillingBypassAgencyView;
}) {
  const [state, action] = useActionState(
    updateAdminAgencySeatBillingBypass,
    initialState,
  );
  const [enabled, setEnabled] = useState(agency.billingBypassEnabled);
  const updated = updatedLabel(agency);
  const billingLabel = enabled
    ? "Bypassed"
    : agency.billingConfigured
      ? agency.paymentMethodLabel || "Billing ready"
      : "Billing required";

  return (
    <form
      action={action}
      className="grid gap-4 border-b border-border bg-background p-4 last:border-b-0 lg:grid-cols-[1.15fr_0.8fr_1.2fr_auto] lg:items-center"
    >
      <input type="hidden" name="agencyId" value={agency.id} />

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{agency.name}</p>
            <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
              {agencyTypeLabel(agency.agencyType)}
              {agency.region ? ` · ${agency.region}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-1 text-sm">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs font-normal text-muted-foreground">
          <CreditCard className="size-3.5 text-primary" />
          {billingLabel}
        </span>
        <p className="text-xs font-normal text-muted-foreground">
          {agency.currentSeats} current {agency.currentSeats === 1 ? "seat" : "seats"}
        </p>
      </div>

      <div className="grid gap-3">
        <Label className="flex w-fit cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 rounded-full border border-border bg-muted transition-colors",
              enabled && "bg-primary",
            )}
          >
            <span
              className={cn(
                "absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow-sm transition-transform",
                enabled && "translate-x-5",
              )}
            />
          </span>
          <span className="text-sm font-semibold">Bypass seat billing</span>
        </Label>

        <Input
          name="reason"
          maxLength={240}
          defaultValue={agency.billingBypassReason || ""}
          placeholder="Reason visible to admins"
        />

        {updated ? (
          <p className="text-xs font-normal text-muted-foreground">{updated}</p>
        ) : null}

        {state.message ? (
          <p
            className={cn(
              "text-xs font-semibold",
              state.ok ? "text-emerald-700" : "text-destructive",
            )}
          >
            {state.message}
          </p>
        ) : null}
      </div>

      <div className="flex justify-start lg:justify-end">
        <SaveButton />
      </div>
    </form>
  );
}

export function AdminAgencyBillingBypassManager({
  agencies,
}: {
  agencies: AdminAgencyBillingBypassAgencyView[];
}) {
  return (
    <section className="mt-8 rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Billing bypass
          </p>
          <h2 className="mt-2 text-xl font-semibold">Agency seat billing switches</h2>
          <p className="mt-2 max-w-3xl text-sm font-normal leading-6 text-muted-foreground">
            Switch bypass on for a branch or independent agency to pause automated
            seat charges. Switching it off starts a fresh billing cycle for current
            seats.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-normal text-muted-foreground">
          <ShieldOff className="size-4 text-primary" />
          Admin only
        </span>
      </div>

      {agencies.length ? (
        <div>
          {agencies.map((agency) => (
            <BillingBypassRow key={agency.id} agency={agency} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-5 text-sm font-normal text-muted-foreground">
          <Power className="size-4 text-primary" />
          No branch or independent agencies are available yet.
        </div>
      )}
    </section>
  );
}

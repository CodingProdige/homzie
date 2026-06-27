"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Save, ShieldCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  updateAdminReservationSettings,
  type AdminReservationSettingsState,
} from "./actions";

export type AdminReservationSettingsView = {
  enabled: boolean;
  platformFeePercent: number;
  processingFeePercent: number;
  processingFixedRands: number;
  minReservationAmountRands: number;
  maxReservationAmountRands: number;
  termsText: string;
};

const initialState: AdminReservationSettingsState = {
  message: "",
  ok: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save className="size-4" />
      {pending ? "Saving..." : "Save reservation settings"}
    </Button>
  );
}

function NumberField({
  description,
  label,
  name,
  step = "1",
  value,
}: {
  description: string;
  label: string;
  name: string;
  step?: string;
  value: number;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        min="0"
        step={step}
        defaultValue={String(value)}
      />
      <p className="text-xs font-normal leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export function AdminReservationSettingsForm({
  settings,
}: {
  settings: AdminReservationSettingsView;
}) {
  const [state, action] = useActionState(
    updateAdminReservationSettings,
    initialState,
  );

  return (
    <form action={action} className="space-y-5">
      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Reservation checkout</h3>
            <p className="text-xs font-normal text-muted-foreground">
              Control availability, buyer fees, and reservation guardrails.
            </p>
          </div>
        </div>

        <label className="mt-4 flex min-w-0 items-center gap-4 rounded-lg border border-border bg-card px-4 py-4">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              Enable listing reservations
            </span>
            <span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">
              Agents can only accept reservation payments when this is enabled
              and their listing has reservations turned on.
            </span>
          </span>
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5"
          />
        </label>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold">Fees</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <NumberField
            name="platformFeePercent"
            label="Homzie fee %"
            value={settings.platformFeePercent}
            step="0.1"
            description="Platform share added on top of the agent's reservation amount."
          />
          <NumberField
            name="processingFeePercent"
            label="Payment fee estimate %"
            value={settings.processingFeePercent}
            step="0.1"
            description="Estimated card fee added on top so the reservation amount is protected."
          />
          <NumberField
            name="processingFixedRands"
            label="Fixed payment fee estimate (R)"
            value={settings.processingFixedRands}
            step="0.01"
            description="Flat processing fee estimate added to each reservation."
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold">Limits and terms</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <NumberField
            name="minReservationAmountRands"
            label="Minimum reservation (R)"
            value={settings.minReservationAmountRands}
            description="Smallest reservation amount an agent can set."
          />
          <NumberField
            name="maxReservationAmountRands"
            label="Maximum reservation (R)"
            value={settings.maxReservationAmountRands}
            description="Largest reservation amount an agent can set."
          />
        </div>
        <label className="mt-4 grid gap-2">
          <Label htmlFor="termsText">Buyer terms</Label>
          <textarea
            id="termsText"
            name="termsText"
            defaultValue={settings.termsText}
            rows={5}
            className="resize-none rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>
      </section>

      {state.message ? (
        <p
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold",
            state.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {state.ok ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <XCircle className="size-4" />
          )}
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

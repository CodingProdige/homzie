"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ReceiptText, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  updateAdminAgencyBillingSettings,
  type AdminAgencyBillingSettingsState,
} from "./actions";

export type AdminAgencyBillingSettingsView = {
  currency: string;
  seatPriceRands: number;
};

const initialState: AdminAgencyBillingSettingsState = {
  message: "",
  ok: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save className="size-4" />
      {pending ? "Saving..." : "Save agency billing"}
    </Button>
  );
}

export function AdminAgencyBillingSettingsForm({
  settings,
}: {
  settings: AdminAgencyBillingSettingsView;
}) {
  const [state, action] = useActionState(
    updateAdminAgencyBillingSettings,
    initialState,
  );

  return (
    <form action={action} className="space-y-5">
      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <ReceiptText className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Member seat price</h3>
            <p className="text-xs font-normal text-muted-foreground">
              This platform-wide price is used for agency peak-seat billing from the moment it is saved.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_10rem]">
          <div className="grid gap-2">
            <Label htmlFor="seatPriceRands">Seat price</Label>
            <Input
              id="seatPriceRands"
              name="seatPriceRands"
              type="number"
              min="1"
              step="1"
              defaultValue={String(settings.seatPriceRands)}
            />
            <p className="text-xs font-normal leading-5 text-muted-foreground">
              Charged per agency-funded public agent seat, using the maximum seats
              used in each 30-day cycle.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              name="currency"
              type="text"
              maxLength={3}
              defaultValue={settings.currency}
            />
            <p className="text-xs font-normal leading-5 text-muted-foreground">
              Use ISO code.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        {state.message ? (
          <p
            className={cn(
              "text-sm font-semibold",
              state.ok ? "text-emerald-700" : "text-destructive",
            )}
          >
            {state.message}
          </p>
        ) : (
          <p className="text-sm font-normal text-muted-foreground">
            Price changes create a new effective price; historic finalized billing periods remain auditable.
          </p>
        )}
        <SubmitButton />
      </div>
    </form>
  );
}

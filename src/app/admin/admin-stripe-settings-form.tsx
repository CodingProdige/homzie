"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, KeyRound, Save, TestTube2, XCircle, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  StripeMode,
  StripeModeSettings,
} from "@/modules/platform-settings/stripe-settings";
import {
  updateAdminStripeSettings,
  type AdminStripeSettingsState,
} from "./actions";

type AdminStripeSettingsFormProps = {
  settings: AdminStripeSettingsView;
};

const initialState: AdminStripeSettingsState = {
  message: "",
  ok: false,
};

export type AdminStripeSettingsView = {
  mode: StripeMode;
  test: Record<keyof StripeModeSettings, boolean>;
  live: Record<keyof StripeModeSettings, boolean>;
};

const fields: Array<{
  key: keyof StripeModeSettings;
  label: string;
  placeholder: string;
  secret?: boolean;
}> = [
  {
    key: "publishableKey",
    label: "Publishable key",
    placeholder: "pk_test_... or pk_live_...",
  },
  {
    key: "secretKey",
    label: "Secret key",
    placeholder: "sk_test_... or sk_live_...",
    secret: true,
  },
  {
    key: "webhookSecret",
    label: "Webhook signing secret",
    placeholder: "whsec_...",
    secret: true,
  },
  {
    key: "monthlyPriceId",
    label: "Monthly price ID",
    placeholder: "price_...",
  },
  {
    key: "yearlyPriceId",
    label: "Yearly price ID",
    placeholder: "price_...",
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save className="size-4" />
      {pending ? "Saving..." : "Save Stripe settings"}
    </Button>
  );
}

function SavedHint({ saved }: { saved: boolean }) {
  if (!saved) {
    return (
      <span className="text-[11px] font-bold text-muted-foreground">
        Not saved
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
      <CheckCircle2 className="size-3" />
      Saved
    </span>
  );
}

function ModeFields({
  mode,
  settings,
}: {
  mode: StripeMode;
  settings: Record<keyof StripeModeSettings, boolean>;
}) {
  const Icon = mode === "test" ? TestTube2 : Zap;

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-black">
            {mode === "test" ? "Sandbox credentials" : "Live credentials"}
          </h3>
          <p className="text-xs font-semibold text-muted-foreground">
            Leave saved secrets blank to keep the current value.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const saved = settings[field.key];

          return (
            <div key={field.key} className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor={`${mode}.${field.key}`}>{field.label}</Label>
                <SavedHint saved={saved} />
              </div>
              <Input
                id={`${mode}.${field.key}`}
                name={`${mode}.${field.key}`}
                type={field.secret ? "password" : "text"}
                autoComplete="off"
                placeholder={saved ? "Leave blank to keep saved value" : field.placeholder}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AdminStripeSettingsForm({
  settings,
}: AdminStripeSettingsFormProps) {
  const [selectedMode, setSelectedMode] = useState<StripeMode>(settings.mode);
  const [state, action] = useActionState(
    updateAdminStripeSettings,
    initialState,
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["test", "live"] as const).map((mode) => {
          const active = selectedMode === mode;
          const Icon = mode === "test" ? TestTube2 : Zap;

          return (
            <label
              key={mode}
              className={cn(
                "flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border bg-background px-4 py-3 transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/15"
                  : "border-border hover:border-primary/35",
              )}
            >
              <input
                type="radio"
                name="mode"
                value={mode}
                checked={active}
                onChange={() => setSelectedMode(mode)}
                className="sr-only"
              />
              <span className="grid size-9 place-items-center rounded-full bg-card text-current">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">
                  {mode === "test" ? "Sandbox mode" : "Live mode"}
                </span>
                <span className="block text-xs font-semibold text-muted-foreground">
                  {mode === "test"
                    ? "Use test cards and sandbox webhooks."
                    : "Use real payments and live webhooks."}
                </span>
              </span>
              {active ? (
                <span className="shrink-0 rounded-full bg-primary px-2 py-1 text-[10px] font-black uppercase text-primary-foreground">
                  Active
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      <ModeFields mode="test" settings={settings.test} />
      <ModeFields mode="live" settings={settings.live} />

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        {state.message ? (
          <p
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold",
              state.ok
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-destructive/25 bg-destructive/10 text-destructive",
            )}
          >
            {state.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            {state.message}
          </p>
        ) : (
          <p className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted-foreground">
            <KeyRound className="size-4" />
            Saved secrets are masked and only replaced when you enter a new value.
          </p>
        )}
        <SubmitButton />
      </div>
    </form>
  );
}

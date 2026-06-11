"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  TestTube2,
  XCircle,
  Zap,
} from "lucide-react";

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

export type AdminStripeSettingsView = {
  mode: StripeMode;
  test: StripeModeSettings;
  live: StripeModeSettings;
};

const initialState: AdminStripeSettingsState = {
  message: "",
  ok: false,
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

function SettingsField({
  mode,
  fieldKey,
  label,
  placeholder,
  secret,
  defaultValue,
}: {
  mode: StripeMode;
  fieldKey: keyof StripeModeSettings;
  label: string;
  placeholder: string;
  secret?: boolean;
  defaultValue: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const id = `${mode}.${fieldKey}`;
  const saved = Boolean(defaultValue);
  const inputType = secret ? (revealed ? "text" : "password") : "text";

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <SavedHint saved={saved} />
      </div>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={inputType}
          autoComplete="off"
          defaultValue={defaultValue}
          placeholder={saved ? "Leave blank to keep saved value" : placeholder}
          className={secret ? "pr-11" : undefined}
        />
        {secret ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ModeFields({
  mode,
  settings,
}: {
  mode: StripeMode;
  settings: StripeModeSettings;
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
        {fields.map((field) => (
          <SettingsField
            key={field.key}
            mode={mode}
            fieldKey={field.key}
            label={field.label}
            placeholder={field.placeholder}
            secret={field.secret}
            defaultValue={settings[field.key]}
          />
        ))}
      </div>
    </section>
  );
}

export function AdminStripeSettingsForm({
  settings,
}: {
  settings: AdminStripeSettingsView;
}) {
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

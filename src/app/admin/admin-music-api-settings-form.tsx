"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Eye, EyeOff, KeyRound, Save, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { MusicApiSettings } from "@/modules/platform-settings/music-api-settings";
import {
  updateAdminMusicApiSettings,
  type AdminMusicApiSettingsState,
} from "./actions";

export type AdminMusicApiSettingsView = {
  jamendoClientId: string;
  freesoundApiKey: string;
};

const initialState: AdminMusicApiSettingsState = {
  message: "",
  ok: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save className="size-4" />
      {pending ? "Saving..." : "Save music API settings"}
    </Button>
  );
}

function SavedHint({ saved }: { saved: boolean }) {
  if (!saved) {
    return (
      <span className="text-[11px] font-normal text-muted-foreground">Not saved</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
      <CheckCircle2 className="size-3" />
      Saved
    </span>
  );
}

function SecretField({
  id,
  label,
  placeholder,
  hint,
  defaultValue,
}: {
  id: string;
  label: string;
  placeholder: string;
  hint: string;
  defaultValue: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const saved = Boolean(defaultValue);

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
          type={revealed ? "text" : "password"}
          autoComplete="off"
          defaultValue={defaultValue}
          placeholder={saved ? "Leave blank to keep saved value" : placeholder}
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <p className="text-[11px] font-normal text-muted-foreground">{hint}</p>
    </div>
  );
}

const fields: Array<{
  key: keyof MusicApiSettings;
  label: string;
  placeholder: string;
  hint: string;
}> = [
  {
    key: "jamendoClientId",
    label: "Jamendo Client ID",
    placeholder: "Your Jamendo Client ID",
    hint: "Free account at developer.jamendo.com — create an app to get a Client ID.",
  },
  {
    key: "freesoundApiKey",
    label: "Freesound API token",
    placeholder: "Your Freesound API token",
    hint: "Get yours at freesound.org/apiv2/apply — free account required.",
  },
];

export function AdminMusicApiSettingsForm({
  settings,
}: {
  settings: AdminMusicApiSettingsView;
}) {
  const [state, action] = useActionState(updateAdminMusicApiSettings, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <SecretField
            key={field.key}
            id={field.key}
            label={field.label}
            placeholder={field.placeholder}
            hint={field.hint}
            defaultValue={settings[field.key]}
          />
        ))}
      </div>

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
            {state.ok ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            )}
            {state.message}
          </p>
        ) : (
          <p className="inline-flex min-h-10 items-center gap-2 text-sm font-normal text-muted-foreground">
            <KeyRound className="size-4" />
            Saved secrets are masked and only replaced when you enter a new value.
          </p>
        )}
        <SubmitButton />
      </div>
    </form>
  );
}

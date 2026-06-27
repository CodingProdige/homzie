"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Save, XCircle } from "lucide-react";

import {
  updateAdminDemoProfileSettings,
  type AdminDemoProfileSettingsState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AdminDemoProfileSettingsView = {
  bio: string;
  contactEmail: string;
  email: string;
  headline: string;
  listingsJson: string;
  location: string;
  name: string;
  username: string;
  visible: boolean;
};

const initialState: AdminDemoProfileSettingsState = {
  message: "",
  ok: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save className="size-4" />
      {pending ? "Saving..." : "Save demo profile"}
    </Button>
  );
}

function TextField({
  label,
  name,
  type = "text",
  value,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={value} />
    </div>
  );
}

export function AdminDemoProfileSettingsForm({
  credentials,
  settings,
}: {
  credentials: {
    defaultPassword: string;
    email: string;
  };
  settings: AdminDemoProfileSettingsView;
}) {
  const [state, action] = useActionState(
    updateAdminDemoProfileSettings,
    initialState,
  );

  return (
    <form action={action} className="space-y-5">
      <section className="rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold">Public profile</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextField label="Name" name="name" value={settings.name} />
          <TextField label="Username" name="username" value={settings.username} />
          <TextField
            label="Login email"
            name="email"
            type="email"
            value={settings.email}
          />
          <TextField
            label="Public contact email"
            name="contactEmail"
            type="email"
            value={settings.contactEmail}
          />
          <TextField label="Headline" name="headline" value={settings.headline} />
          <TextField label="Location" name="location" value={settings.location} />
        </div>

        <label className="mt-4 grid gap-2">
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={settings.bio}
            rows={4}
            className="rounded-md border border-border bg-background px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>

        <label className="mt-4 flex min-w-0 items-center gap-4 rounded-lg border border-border bg-card px-4 py-4">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Show demo profile</span>
            <span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">
              When enabled, the profile, active demo listings, and performance
              page are publicly accessible.
            </span>
          </span>
          <input
            type="checkbox"
            name="visible"
            defaultChecked={settings.visible}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5"
          />
        </label>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold">Login credentials</h3>
        <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
          Current demo login email: {credentials.email}. Default password:
          {" "}{credentials.defaultPassword}. Enter a new password below only
          when you want to reset it.
        </p>
        <div className="mt-4 max-w-md">
          <TextField label="Reset password" name="password" type="text" value="" />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold">Listings and performance data</h3>
        <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
          This JSON recreates the demo listings. Sold rows feed the public
          performance page; published rows show as active showcase listings.
        </p>
        <textarea
          name="listingsJson"
          defaultValue={settings.listingsJson}
          rows={22}
          spellCheck={false}
          className="mt-4 w-full rounded-md border border-border bg-background px-3 py-3 font-mono text-xs leading-5 outline-none focus:ring-2 focus:ring-primary/25"
        />
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

"use client";

import { useActionState } from "react";
import {
  Eye,
  Loader2,
  LockKeyhole,
  Save,
  Search,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SettingsPageHeader } from "../settings-page-header";
import { updatePrivacySettings, type PrivacySettingsState } from "./actions";

export type PrivacyFormValues = {
  profileVisible: boolean;
  publicContactVisible: boolean;
  publicPerformanceVisible: boolean;
  searchVisible: boolean;
};

const emptyPrivacySettingsState: PrivacySettingsState = {
  message: "",
  ok: false,
};

function PrivacySwitch({
  checked,
  description,
  icon: Icon,
  name,
  title,
}: {
  checked: boolean;
  description: string;
  icon: typeof LockKeyhole;
  name: keyof PrivacyFormValues;
  title: string;
}) {
  return (
    <label className="flex min-w-0 items-center gap-4 rounded-lg border border-border bg-background px-4 py-4 transition hover:border-primary/35 hover:bg-primary/5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
      />
    </label>
  );
}

export function PrivacyForm({ preferences }: { preferences: PrivacyFormValues }) {
  const [state, formAction, isPending] = useActionState(
    updatePrivacySettings,
    emptyPrivacySettingsState,
  );

  return (
    <form action={formAction}>
      <SettingsPageHeader
        title="Privacy"
        message={state.message}
        messageTone={state.ok ? "success" : state.message ? "error" : "neutral"}
        actions={
          <Button type="submit" disabled={isPending} className="h-11 px-5 text-sm">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save changes
          </Button>
        }
      />

      <div className="flex w-full flex-col gap-5 py-6">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-normal text-card-foreground">
              Public profile
            </h2>
            <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
              Control whether your Homzie profile can be viewed publicly.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <PrivacySwitch
              checked={preferences.profileVisible}
              name="profileVisible"
              title="Show my public profile"
              description="Allow your profile, reels page and performance page to stay visible on Homzie."
              icon={Eye}
            />
            <div className="rounded-lg border border-border bg-primary/5 px-4 py-3 text-sm font-semibold leading-6 text-foreground">
              Turning this off hides your public profile, reels page and performance page from visitors.
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-normal text-card-foreground">
              Public performance
            </h2>
            <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
              Choose whether visitors can see your sold totals, win rate, and public performance page.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <PrivacySwitch
              checked={preferences.publicPerformanceVisible}
              name="publicPerformanceVisible"
              title="Show my performance publicly"
              description="Display sales performance on agent cards, your profile, and your public performance page."
              icon={Trophy}
            />
            <div className="rounded-lg border border-border bg-primary/5 px-4 py-3 text-sm font-semibold leading-6 text-foreground">
              Turning this off keeps your performance private from visitors. You can still see your own analytics and performance data.
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-normal text-card-foreground">
              Discoverability
            </h2>
            <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
              Choose how easily people can find you across Homzie.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <PrivacySwitch
              checked={preferences.searchVisible}
              name="searchVisible"
              title="Appear in search"
              description="Show your account in username search and profile discovery."
              icon={Search}
            />
            <PrivacySwitch
              checked={preferences.publicContactVisible}
              name="publicContactVisible"
              title="Show contact details publicly"
              description="Display your email, phone and WhatsApp details on public profile and listing surfaces."
              icon={ShieldCheck}
            />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <LockKeyhole className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-normal text-card-foreground">
                What changes publicly
              </h2>
              <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
                Search visibility affects discovery. Profile visibility affects whether your public pages can be opened. Public contact visibility controls whether your contact details are shown on profile and listing surfaces.
                Public performance visibility only controls public display of sales performance; it does not delete or change your private analytics.
              </p>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}

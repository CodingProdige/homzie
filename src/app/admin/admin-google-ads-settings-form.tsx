"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  updateAdminGoogleAdsSettings,
  type AdminGoogleAdsSettingsState,
} from "./actions";

export type AdminGoogleAdsSettingsView = {
  enabled: boolean;
  automationEnabled: boolean;
  customerId: string;
  clientId: string;
  clientSecret: string;
  developerToken: string;
  dsaCampaignId: string;
  feedUrl: string;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasDeveloperToken: boolean;
  hasRefreshToken: boolean;
  languageCode: string;
  loginCustomerId: string;
  pageFeedLabel: string;
  pageFeedToken: string;
  refreshToken: string;
  siteDomain: string;
  descriptionLine1: string;
  descriptionLine2: string;
};

const initialState: AdminGoogleAdsSettingsState = {
  message: "",
  ok: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save className="size-4" />
      {pending ? "Saving..." : "Save Google Ads settings"}
    </Button>
  );
}

function SavedSecretHint({ saved }: { saved: boolean }) {
  return saved ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
      <CheckCircle2 className="size-3" />
      Saved
    </span>
  ) : (
    <span className="text-[11px] font-bold text-muted-foreground">Not saved</span>
  );
}

function ToggleField({
  defaultChecked,
  description,
  label,
  name,
}: {
  defaultChecked: boolean;
  description: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex min-w-0 items-center gap-4 rounded-lg border border-border bg-background px-4 py-4 transition hover:border-primary/35 hover:bg-primary/5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">{label}</span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5"
      />
    </label>
  );
}

function SecretField({
  defaultValue,
  id,
  label,
  placeholder,
  saved,
}: {
  defaultValue: string;
  id: string;
  label: string;
  placeholder: string;
  saved: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <SavedSecretHint saved={saved} />
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
          onClick={() => setRevealed((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export function AdminGoogleAdsSettingsForm({
  settings,
}: {
  settings: AdminGoogleAdsSettingsView;
}) {
  const [state, action] = useActionState(updateAdminGoogleAdsSettings, initialState);

  return (
    <form action={action} className="space-y-5">
      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <Globe2 className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-black">Google DSA control</h3>
            <p className="text-xs font-semibold text-muted-foreground">
              Homzie owns the Google Ads account and page feed. Users only choose which published listings should be eligible.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ToggleField
            name="enabled"
            label="Enable Google listing promotion"
            description="Shows Google as a channel inside Ads Center for published listings."
            defaultChecked={settings.enabled}
          />
          <ToggleField
            name="automationEnabled"
            label="Enable campaign pause/resume automation"
            description="Uses the Google Ads API to pause the DSA campaign when no active listing URLs remain, and re-enable it when listings return."
            defaultChecked={settings.automationEnabled}
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-black">Feed and campaign</h3>
            <p className="text-xs font-semibold text-muted-foreground">
              Create one Homzie-managed Dynamic Search Ads campaign, then let Google fetch this feed URL on a schedule.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="siteDomain">Website domain</Label>
            <Input id="siteDomain" name="siteDomain" defaultValue={settings.siteDomain} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="languageCode">Language code</Label>
            <Input id="languageCode" name="languageCode" defaultValue={settings.languageCode} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pageFeedLabel">Page feed label</Label>
            <Input id="pageFeedLabel" name="pageFeedLabel" defaultValue={settings.pageFeedLabel} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pageFeedToken">Feed token</Label>
            <Input
              id="pageFeedToken"
              name="pageFeedToken"
              defaultValue={settings.pageFeedToken}
              placeholder="Use a long random string"
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="feedPreview">Protected feed URL</Label>
            <Input id="feedPreview" readOnly value={settings.feedUrl} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customerId">Google Ads customer ID</Label>
            <Input id="customerId" name="customerId" defaultValue={settings.customerId} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loginCustomerId">Login customer ID</Label>
            <Input
              id="loginCustomerId"
              name="loginCustomerId"
              defaultValue={settings.loginCustomerId}
              placeholder="Only needed if using an MCC"
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="dsaCampaignId">Dynamic Search Ads campaign ID</Label>
            <Input
              id="dsaCampaignId"
              name="dsaCampaignId"
              defaultValue={settings.dsaCampaignId}
              placeholder="The numeric campaign ID from Google Ads"
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="descriptionLine1">Ad description line 1</Label>
            <Input
              id="descriptionLine1"
              name="descriptionLine1"
              defaultValue={settings.descriptionLine1}
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="descriptionLine2">Ad description line 2</Label>
            <Input
              id="descriptionLine2"
              name="descriptionLine2"
              defaultValue={settings.descriptionLine2}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-black">API credentials</h3>
            <p className="text-xs font-semibold text-muted-foreground">
              Only needed for automatic campaign pause and reactivation.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SecretField
            defaultValue={settings.developerToken}
            id="developerToken"
            label="Developer token"
            placeholder="Google Ads developer token"
            saved={settings.hasDeveloperToken}
          />
          <SecretField
            defaultValue={settings.clientId}
            id="clientId"
            label="OAuth client ID"
            placeholder="Google OAuth client ID"
            saved={settings.hasClientId}
          />
          <SecretField
            defaultValue={settings.clientSecret}
            id="clientSecret"
            label="OAuth client secret"
            placeholder="Google OAuth client secret"
            saved={settings.hasClientSecret}
          />
          <SecretField
            defaultValue={settings.refreshToken}
            id="refreshToken"
            label="Refresh token"
            placeholder="Refresh token for the Homzie Google Ads account"
            saved={settings.hasRefreshToken}
          />
        </div>
      </section>

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
            Keep the feed URL scheduled inside Google Ads so listing changes flow through automatically.
          </p>
        )}
        <SubmitButton />
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BarChart3, CheckCircle2, Megaphone, Save, Target, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updateAdminAdsSettings, type AdminAdsSettingsState } from "./actions";

export type AdminAdsSettingsView = {
  allowGoogleAds: boolean;
  allowHomzieAds: boolean;
  defaultMarginPercent: number;
  googleMarginPercent: number;
  homzieMarginPercent: number;
  minCampaignBudgetRands: number;
  maxCampaignBudgetRands: number;
  homzieAverageCpmRands: number;
  googleAverageCpmRands: number;
  homzieReachSharePercent: number;
  googleReachSharePercent: number;
  homzieCtrPercent: number;
  googleCtrPercent: number;
  profileVisitRatePercent: number;
  listingViewRatePercent: number;
  reelPlayRatePercent: number;
  leadRatePercent: number;
};

const initialState: AdminAdsSettingsState = {
  message: "",
  ok: false,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      <Save className="size-4" />
      {pending ? "Saving..." : "Save ads settings"}
    </Button>
  );
}

function NumberField({
  decimal = false,
  description,
  label,
  name,
  value,
}: {
  decimal?: boolean;
  description: string;
  label: string;
  name: string;
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
        step={decimal ? "0.1" : "1"}
        defaultValue={String(value)}
      />
      <p className="text-xs font-normal leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
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
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">
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

export function AdminAdsSettingsForm({
  settings,
}: {
  settings: AdminAdsSettingsView;
}) {
  const [state, action] = useActionState(updateAdminAdsSettings, initialState);

  return (
    <form action={action} className="space-y-5">
      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <Megaphone className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Channel availability</h3>
            <p className="text-xs font-normal text-muted-foreground">
              Control which ad channels users can launch from Ads Center.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ToggleField
            name="allowHomzieAds"
            label="Enable Homzie ads"
            description="Allow users to promote profiles, listings and reels inside Homzie."
            defaultChecked={settings.allowHomzieAds}
          />
          <ToggleField
            name="allowGoogleAds"
            label="Enable Google ads"
            description="Allow users to prepare campaigns for Google distribution from the same ads workflow."
            defaultChecked={settings.allowGoogleAds}
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <BarChart3 className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Pricing</h3>
            <p className="text-xs font-normal text-muted-foreground">
              Set margin and budget guardrails for all ads created through Homzie.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <NumberField
            name="defaultMarginPercent"
            label="Default margin %"
            value={settings.defaultMarginPercent}
            decimal
            description="Fallback margin if a channel-specific margin is changed later."
          />
          <NumberField
            name="homzieMarginPercent"
            label="Homzie margin %"
            value={settings.homzieMarginPercent}
            decimal
            description="Internal margin applied to in-app campaign budgets."
          />
          <NumberField
            name="googleMarginPercent"
            label="Google margin %"
            value={settings.googleMarginPercent}
            decimal
            description="Internal margin applied to Google campaign budgets."
          />
          <NumberField
            name="minCampaignBudgetRands"
            label="Minimum budget (R)"
            value={settings.minCampaignBudgetRands}
            description="Smallest campaign budget users can launch."
          />
          <NumberField
            name="maxCampaignBudgetRands"
            label="Maximum budget (R)"
            value={settings.maxCampaignBudgetRands}
            description="Largest campaign budget users can set from the self-serve flow."
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <Target className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Forecast model</h3>
            <p className="text-xs font-normal text-muted-foreground">
              These inputs drive the estimated reach, clicks and result curves users see as they change budget.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <NumberField
            name="homzieAverageCpmRands"
            label="Homzie average CPM (R)"
            value={settings.homzieAverageCpmRands}
            decimal
            description="Average cost per thousand in-app impressions."
          />
          <NumberField
            name="googleAverageCpmRands"
            label="Google average CPM (R)"
            value={settings.googleAverageCpmRands}
            decimal
            description="Average cost per thousand impressions across Google campaign plans."
          />
          <NumberField
            name="homzieReachSharePercent"
            label="Homzie reach share %"
            value={settings.homzieReachSharePercent}
            decimal
            description="Estimated unique reach as a share of total impressions."
          />
          <NumberField
            name="googleReachSharePercent"
            label="Google reach share %"
            value={settings.googleReachSharePercent}
            decimal
            description="Estimated unique reach as a share of total impressions."
          />
          <NumberField
            name="homzieCtrPercent"
            label="Homzie CTR %"
            value={settings.homzieCtrPercent}
            decimal
            description="Estimated click-through rate for in-app campaigns."
          />
          <NumberField
            name="googleCtrPercent"
            label="Google CTR %"
            value={settings.googleCtrPercent}
            decimal
            description="Estimated click-through rate for Google campaigns."
          />
          <NumberField
            name="profileVisitRatePercent"
            label="Profile visit rate %"
            value={settings.profileVisitRatePercent}
            decimal
            description="How many clicks typically convert into profile visits."
          />
          <NumberField
            name="listingViewRatePercent"
            label="Listing view rate %"
            value={settings.listingViewRatePercent}
            decimal
            description="How many clicks typically convert into listing views."
          />
          <NumberField
            name="reelPlayRatePercent"
            label="Reel play rate %"
            value={settings.reelPlayRatePercent}
            decimal
            description="How many clicks typically convert into reel plays."
          />
          <NumberField
            name="leadRatePercent"
            label="Lead rate %"
            value={settings.leadRatePercent}
            decimal
            description="How many clicks typically convert into leads for lead-focused campaigns."
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
          <p className="inline-flex min-h-10 items-center gap-2 text-sm font-normal text-muted-foreground">
            Saved forecast settings immediately affect Ads Center estimates.
          </p>
        )}
        <SubmitButton />
      </div>
    </form>
  );
}

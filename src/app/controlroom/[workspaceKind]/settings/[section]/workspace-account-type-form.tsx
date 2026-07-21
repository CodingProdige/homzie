"use client";

import { useActionState, useState } from "react";
import { Loader2, Network, UserRound, Warehouse } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  changeWorkspaceAccountTypeAction,
  type WorkspaceAccountTypeActionState,
} from "@/modules/agencies/actions";

type TargetOption = {
  description: string;
  icon: typeof Network;
  label: string;
  reasons: string[];
  value: "independent" | "personal";
};

export function WorkspaceAccountTypeForm({
  agencyId,
  currentType,
  independentReasons,
  personalReasons,
}: {
  agencyId: string;
  currentType: "branch" | "independent" | "network";
  independentReasons: string[];
  personalReasons: string[];
}) {
  const initialState: WorkspaceAccountTypeActionState = { message: "", ok: true };
  const [state, formAction, isPending] = useActionState(
    changeWorkspaceAccountTypeAction,
    initialState,
  );
  const [targetType, setTargetType] = useState<"independent" | "personal">(
    currentType === "network" ? "independent" : "personal",
  );

  const options: TargetOption[] = [
    ...(currentType === "network"
      ? [{
          description: "Keep the workspace, brand, owner, and listings, without Network HQ features.",
          icon: Warehouse,
          label: "Independent agency",
          reasons: independentReasons,
          value: "independent" as const,
        }]
      : []),
    {
      description: "Close the unused agency workspace and continue with an individual agent profile.",
      icon: UserRound,
      label: "Personal agent account",
      reasons: personalReasons,
      value: "personal",
    },
  ];
  const selected = options.find((option) => option.value === targetType) || options[0];
  const blocked = !selected || selected.reasons.length > 0;

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="agencyId" value={agencyId} />
      <input type="hidden" name="targetType" value={targetType} />

      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          const active = option.value === targetType;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTargetType(option.value)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4 text-primary" />
                {option.label}
              </span>
              <span className="mt-2 block text-xs font-normal leading-5 text-muted-foreground">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>

      {selected?.reasons.length ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Resolve these items before converting:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">
            {selected.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold leading-5 text-emerald-800 dark:text-emerald-200">
          This workspace is eligible for the selected conversion. Existing data is preserved unless the unused workspace is closed.
        </p>
      )}

      {state.message ? (
        <p className={cn("text-sm font-semibold", state.ok ? "text-emerald-700" : "text-destructive")}>{state.message}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={blocked || isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Change account type
        </Button>
      </div>
    </form>
  );
}

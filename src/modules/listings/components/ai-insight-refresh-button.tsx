"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AiInsightRefreshButtonProps = {
  cooldownSeconds: number;
  refreshHref: string;
  refreshRequested?: boolean;
};

export function AiInsightRefreshButton({
  cooldownSeconds,
  refreshHref,
  refreshRequested = false,
}: AiInsightRefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cooldown, setCooldown] = useState(() =>
    Math.max(0, Math.ceil(cooldownSeconds)),
  );
  const [appliedRefreshRequest, setAppliedRefreshRequest] = useState(false);

  useEffect(() => {
    setCooldown(Math.max(0, Math.ceil(cooldownSeconds)));
  }, [cooldownSeconds]);

  useEffect(() => {
    if (refreshRequested && !appliedRefreshRequest && cooldown <= 0) {
      setCooldown(30);
      setAppliedRefreshRequest(true);
    }
  }, [appliedRefreshRequest, cooldown, refreshRequested]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const interval = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [cooldown]);

  const disabled = isPending || cooldown > 0;
  const label = isPending
    ? "Updating AI..."
    : cooldown > 0
      ? `AI refresh in ${cooldown}s`
      : "Refresh AI insight";

  return (
    <Button
      type="button"
      size="sm"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;

        setCooldown(30);
        startTransition(() => {
          router.push(refreshHref, { scroll: false });
        });
      }}
      className={cn(
        "h-9 rounded-full border border-primary/35 bg-white px-3 text-xs font-black text-primary shadow-[0_0_0_3px_rgba(124,86,255,0.12)] transition-all hover:border-primary/60 hover:bg-primary/5 hover:shadow-[0_0_0_4px_rgba(124,86,255,0.16)] disabled:opacity-75",
        "whitespace-nowrap dark:bg-background",
      )}
      variant="outline"
    >
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <WandSparkles className={cn("size-3.5", isPending && "animate-pulse")} />
      </span>
      <span className="truncate">{label}</span>
    </Button>
  );
}

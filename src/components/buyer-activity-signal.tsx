import { Radar, Sparkles, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type BuyerActivitySignalIconProps = {
  active?: boolean;
  className?: string;
  icon?: LucideIcon;
  size?: "sm" | "md";
};

const signalSizes = {
  md: {
    frame: "size-6",
    icon: "size-3.5",
    sparkFrame: "size-3.5 -right-1 -top-1",
    sparkIcon: "size-2.5",
  },
  sm: {
    frame: "size-5",
    icon: "size-3",
    sparkFrame: "size-3 -right-1 -top-0.5",
    sparkIcon: "size-2",
  },
} satisfies Record<
  string,
  { frame: string; icon: string; sparkFrame: string; sparkIcon: string }
>;

export function BuyerActivitySignalIcon({
  active = false,
  className,
  icon: Icon = Radar,
  size = "md",
}: BuyerActivitySignalIconProps) {
  const sizing = signalSizes[size];

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full bg-primary/10 text-primary shadow-[0_0_18px_rgba(123,92,255,0.18)] ring-1 ring-primary/20",
        active && "bg-primary text-primary-foreground shadow-[0_0_22px_rgba(123,92,255,0.34)] ring-primary/30",
        sizing.frame,
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-0 rounded-full bg-primary/10 blur-[6px] motion-safe:animate-pulse" />
      <Icon className={cn("relative z-10", sizing.icon)} />
      <span
        className={cn(
          "absolute z-20 grid place-items-center rounded-full border border-background bg-background text-primary shadow-sm",
          sizing.sparkFrame,
        )}
      >
        <Sparkles className={cn("fill-current", sizing.sparkIcon)} />
      </span>
    </span>
  );
}

export function BuyerActivityLivePill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full border border-primary/20 bg-primary/10 px-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-primary",
        className,
      )}
    >
      Live
    </span>
  );
}

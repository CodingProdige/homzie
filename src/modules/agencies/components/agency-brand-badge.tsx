import Image from "next/image";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import type { AgencyBadgeStyle } from "@/modules/agencies/brand-style";
import {
  defaultAgencyBadgeStyle,
} from "@/modules/agencies/brand-style";
import type { EffectiveAgencyBrand } from "@/modules/agencies/server";

type AgencyBrandBadgeProps = {
  brand: Pick<
    EffectiveAgencyBrand,
    "badgeLabel" | "badgeStyle" | "logoUrl" | "name"
  >;
  className?: string;
  logoClassName?: string;
  size?: "card" | "sm" | "md";
};

function badgeStyle(value?: AgencyBadgeStyle): CSSProperties {
  const style = value || defaultAgencyBadgeStyle;

  return {
    backgroundColor: style.backgroundColor,
    borderRadius: style.borderRadius,
    color: style.textColor,
    fontFamily: style.fontFamily,
    fontWeight: Number(style.fontWeight),
  };
}

export function AgencyBrandBadge({
  brand,
  className,
  logoClassName,
  size = "md",
}: AgencyBrandBadgeProps) {
  const logoUrl = brand.logoUrl || "";
  const hasLogo = Boolean(logoUrl);
  const label = brand.badgeLabel || brand.name;
  const logoSizes = size === "card" ? "10rem" : size === "sm" ? "4rem" : "8rem";

  return (
    <span
      className={cn(
        "relative inline-flex max-w-full items-center overflow-hidden border border-foreground/15 leading-none shadow-[0_2px_0_rgba(17,17,26,0.08),0_10px_22px_rgba(17,17,26,0.10)] ring-1 ring-foreground/10 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-white/45",
        hasLogo ? "justify-center" : "gap-2",
        size === "card" && hasLogo && "h-12 w-40 p-0 text-[10px]",
        size === "card" && !hasLogo && "min-h-10 max-w-[9rem] px-3 py-2 text-[10px]",
        size === "sm" && hasLogo && "h-6 w-16 p-0 text-[10px]",
        size === "sm" && !hasLogo && "min-h-6 px-2.5 py-1 text-[10px]",
        size === "md" && hasLogo && "h-9 w-32 p-0 text-xs",
        size === "md" && !hasLogo && "min-h-8 px-4 py-2 text-xs",
        className,
      )}
      style={badgeStyle(brand.badgeStyle)}
      title={label}
    >
      {hasLogo ? (
        <span
          className={cn(
            "relative block size-full shrink-0 overflow-hidden",
            logoClassName,
          )}
        >
          <Image
            src={logoUrl}
            alt={label}
            fill
            sizes={logoSizes}
            className="object-cover"
          />
        </span>
      ) : (
        <span className="truncate">{label}</span>
      )}
    </span>
  );
}

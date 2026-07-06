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
  size?: "sm" | "md";
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
  const logoWidth = size === "sm" ? 42 : 64;
  const logoHeight = size === "sm" ? 14 : 20;

  return (
    <span
      className={cn(
        "relative inline-flex max-w-full items-center overflow-hidden border border-foreground/15 leading-none shadow-[0_2px_0_rgba(17,17,26,0.08),0_10px_22px_rgba(17,17,26,0.10)] ring-1 ring-foreground/10 after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-white/45",
        hasLogo ? "justify-center" : "gap-2",
        size === "sm" && hasLogo && "min-h-6 px-2 py-1 text-[10px]",
        size === "sm" && !hasLogo && "min-h-6 px-2.5 py-1 text-[10px]",
        size === "md" && hasLogo && "min-h-8 px-3 py-1.5 text-xs",
        size === "md" && !hasLogo && "min-h-8 px-4 py-2 text-xs",
        className,
      )}
      style={badgeStyle(brand.badgeStyle)}
      title={label}
    >
      {hasLogo ? (
        <span
          className={cn(
            "grid shrink-0 place-items-center overflow-hidden",
            size === "sm" ? "h-4 w-12" : "h-6 w-[4.5rem]",
            logoClassName,
          )}
        >
          <Image
            src={logoUrl}
            alt={label}
            width={logoWidth}
            height={logoHeight}
            className="size-full object-contain"
          />
        </span>
      ) : (
        <span className="truncate">{label}</span>
      )}
    </span>
  );
}

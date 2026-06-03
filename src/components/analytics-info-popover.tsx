"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

export function AnalyticsInfoPopover({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const rootRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setMounted(true), 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = rootRef.current?.getBoundingClientRect();
      if (!trigger) return;

      const width = 256;
      const padding = 12;
      const left = Math.min(
        Math.max(trigger.left + trigger.width / 2 - width / 2, padding),
        window.innerWidth - width - padding,
      );

      setPosition({
        left,
        top: trigger.bottom + 8,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !rootRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        className="inline-grid size-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        aria-label={`About ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Info className="size-3.5" />
      </button>
      {open && mounted
        ? createPortal(
        <span
          ref={popoverRef}
          role="tooltip"
          className="fixed z-[100] w-64 rounded-lg border border-border bg-white p-3 text-left text-brand-black shadow-xl"
          style={{ left: position.left, top: position.top }}
        >
          <span className="block text-xs font-black uppercase tracking-wide">
            {title}
          </span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">
            {description}
          </span>
        </span>,
          document.body,
        )
        : null}
    </span>
  );
}

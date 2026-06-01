"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";

const modes: Array<{ mode: ThemeMode; icon: typeof Sun; label: string }> = [
  { mode: "light", icon: Sun, label: "Light mode" },
  { mode: "dark", icon: Moon, label: "Dark mode" },
  { mode: "system", icon: Monitor, label: "System theme" },
];

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldUseDark = mode === "dark" || (mode === "system" && prefersDark);

  document.documentElement.classList.toggle("dark", shouldUseDark);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const storedMode = window.localStorage.getItem("homzie-theme");
    return storedMode === "dark" ||
      storedMode === "system" ||
      storedMode === "light"
      ? storedMode
      : "light";
  });

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (mode === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  const updateMode = (nextMode: ThemeMode) => {
    setMode(nextMode);
    window.localStorage.setItem("homzie-theme", nextMode);
    applyTheme(nextMode);
  };

  return (
    <div className="flex items-center gap-1 rounded-full border bg-card p-1 shadow-sm">
      {modes.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.mode}
            type="button"
            aria-label={item.label}
            aria-pressed={mode === item.mode}
            onClick={() => updateMode(item.mode)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground",
              mode === item.mode && "bg-secondary text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

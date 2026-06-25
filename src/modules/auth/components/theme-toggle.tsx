"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark";

const themeCookieName = "homzie-theme";
const themeMaxAgeSeconds = 60 * 60 * 24 * 365;

const modes: Array<{ mode: ThemeMode; icon: typeof Sun; label: string }> = [
  { mode: "light", icon: Sun, label: "Light mode" },
  { mode: "dark", icon: Moon, label: "Dark mode" },
];

function applyTheme(mode: ThemeMode) {
  const shouldUseDark = mode === "dark";

  document.documentElement.classList.toggle("dark", shouldUseDark);
  document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
}

function persistTheme(mode: ThemeMode) {
  window.localStorage.setItem("homzie-theme", mode);
  document.cookie = `${themeCookieName}=${encodeURIComponent(mode)}; Max-Age=${themeMaxAgeSeconds}; Path=/; SameSite=Lax`;
  document.cookie = "homzie-theme-effective=; Max-Age=0; Path=/; SameSite=Lax";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const storedMode = window.localStorage.getItem("homzie-theme");
    return storedMode === "dark" || storedMode === "light"
      ? storedMode
      : "light";
  });

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  const updateMode = (nextMode: ThemeMode) => {
    setMode(nextMode);
    persistTheme(nextMode);
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

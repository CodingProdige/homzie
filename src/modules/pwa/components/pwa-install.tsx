"use client";

import { useEffect, useState } from "react";
import { ChevronRight, MonitorDown } from "lucide-react";

import { cn } from "@/lib/utils";

type BeforeInstallPromptOutcome = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptOutcome>;
};

const installPromptEventName = "homzie-install-prompt-change";

declare global {
  interface Window {
    __homzieInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

function notifyInstallPromptChange() {
  window.dispatchEvent(new Event(installPromptEventName));
}

export function PwaInstallBootstrap() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__homzieInstallPrompt = event as BeforeInstallPromptEvent;
      notifyInstallPromptChange();
    };

    const handleAppInstalled = () => {
      window.__homzieInstallPrompt = null;
      notifyInstallPromptChange();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}

export function InstallHomzieButton({
  className,
  label = "Install Homzie",
}: {
  className?: string;
  label?: string;
}) {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const updateInstallAvailability = () => {
      setCanInstall(Boolean(window.__homzieInstallPrompt) && !isStandaloneDisplay());
    };

    updateInstallAvailability();
    window.addEventListener(installPromptEventName, updateInstallAvailability);

    return () => {
      window.removeEventListener(installPromptEventName, updateInstallAvailability);
    };
  }, []);

  if (!canInstall) return null;

  return (
    <button
      type="button"
      className={cn(
        "flex h-12 w-full min-w-0 items-center justify-center gap-3 rounded-md bg-[image:var(--homzie-gradient)] px-5 text-center text-sm font-black text-white shadow-[0_14px_30px_rgba(123,92,255,0.28)] transition hover:scale-[1.005] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2",
        className,
      )}
      onClick={async () => {
        const installPrompt = window.__homzieInstallPrompt;
        if (!installPrompt) return;

        window.__homzieInstallPrompt = null;
        setCanInstall(false);
        await installPrompt.prompt();
        await installPrompt.userChoice;
        notifyInstallPromptChange();
      }}
    >
      <MonitorDown className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
      <ChevronRight className="size-4 shrink-0" />
    </button>
  );
}

export function InstallHomzieSettingsRow() {
  return <InstallHomzieButton />;
}

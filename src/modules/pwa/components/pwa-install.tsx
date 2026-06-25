"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Download,
  Loader2,
  MonitorDown,
  PlusSquare,
  Share,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { enablePushNotifications } from "@/modules/push/components/push-notification-bootstrap";

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
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function notifyInstallPromptChange() {
  window.dispatchEvent(new Event(installPromptEventName));
}

function onIdle(callback: () => void) {
  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 3000 });

    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = globalThis.setTimeout(callback, 1500);

  return () => globalThis.clearTimeout(timeoutId);
}

export function PwaInstallBootstrap() {
  useEffect(() => {
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
    const cancelIdleWork = onIdle(() => {
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
    });

    return () => {
      cancelIdleWork();
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}

function getPlatformLabel() {
  if (typeof window === "undefined") return "desktop";

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIpadOSDesktop =
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(userAgent) || isIpadOSDesktop) return "ios";
  if (/android/.test(userAgent)) return "android";

  return "desktop";
}

export function usePwaInstallState() {
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  useEffect(() => {
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstallState = () => {
      setPlatform(getPlatformLabel());
      setIsInstalled(isStandaloneDisplay());
      setCanPromptInstall(Boolean(window.__homzieInstallPrompt) && !isStandaloneDisplay());
      setNotificationPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      );
    };

    updateInstallState();
    window.addEventListener(installPromptEventName, updateInstallState);
    displayModeQuery.addEventListener?.("change", updateInstallState);

    return () => {
      window.removeEventListener(installPromptEventName, updateInstallState);
      displayModeQuery.removeEventListener?.("change", updateInstallState);
    };
  }, []);

  return {
    canPromptInstall,
    isInstalled,
    notificationPermission,
    platform,
  };
}

export async function promptHomzieInstall() {
  const installPrompt = window.__homzieInstallPrompt;

  if (!installPrompt) return false;

  window.__homzieInstallPrompt = null;
  notifyInstallPromptChange();
  await installPrompt.prompt();
  await installPrompt.userChoice;
  notifyInstallPromptChange();

  return true;
}

export function InstallHomzieButton({
  className,
  label = "Install Homzie",
  compact = false,
}: {
  className?: string;
  label?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/install"
      className={cn(
        "flex h-12 w-full min-w-0 items-center justify-center gap-3 rounded-md bg-[image:var(--homzie-gradient)] px-5 text-center text-sm font-black text-white shadow-[0_14px_30px_rgba(123,92,255,0.28)] transition hover:scale-[1.005] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2",
        compact && "h-9 w-auto px-3 text-xs",
        className,
      )}
    >
      <MonitorDown className={cn("size-4 shrink-0", compact && "size-3.5")} />
      <span className="min-w-0 truncate">{label}</span>
      <ChevronRight className={cn("size-4 shrink-0", compact && "size-3.5")} />
    </Link>
  );
}

export function InstallHomzieSettingsRow() {
  return <InstallHomzieButton />;
}

function StatusPill({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200"
          : "border-border bg-muted/60 text-muted-foreground",
      )}
    >
      {active ? <Check className="size-3.5" /> : null}
      {children}
    </span>
  );
}

function InstructionStep({
  icon: Icon,
  label,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-background p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-foreground">{label}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">
          {detail}
        </span>
      </span>
    </div>
  );
}

export function PwaInstallFlow({ className }: { className?: string }) {
  const { canPromptInstall, isInstalled, notificationPermission, platform } =
    usePwaInstallState();
  const [isPromptingInstall, setIsPromptingInstall] = useState(false);
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const [notice, setNotice] = useState("");
  const notificationsEnabled = notificationPermission === "granted";
  const notificationsBlocked = notificationPermission === "denied";
  const isIos = platform === "ios";

  return (
    <div className={cn("grid gap-4", className)}>
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_0.95fr] lg:p-8">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary">
              <Sparkles className="size-3.5" />
              Homzie app setup
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-foreground sm:text-5xl">
              Install Homzie and keep buyer alerts close.
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground sm:text-base">
              Get faster access to listings, messages, buyer activity, and the app-like
              Homzie experience on this device.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusPill active={isInstalled}>App installed</StatusPill>
              <StatusPill active={notificationsEnabled}>Notifications enabled</StatusPill>
            </div>
          </div>

          <div className="relative min-h-56 overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_30%_15%,rgba(123,92,255,0.26),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(255,77,184,0.18),transparent_32%),linear-gradient(135deg,hsl(var(--muted)),hsl(var(--background)))] p-5">
            <div className="absolute right-5 top-5 rounded-full bg-background/80 px-3 py-1 text-xs font-black text-primary shadow-sm">
              Homzie
            </div>
            <div className="flex h-full min-h-48 items-center justify-center">
              <div className="relative flex size-36 items-center justify-center rounded-[2rem] bg-brand-midnight text-white shadow-2xl shadow-primary/25">
                <Smartphone className="size-16" />
                <span className="absolute -right-3 -top-3 flex size-11 items-center justify-center rounded-full bg-[image:var(--homzie-gradient)] shadow-lg">
                  <Bell className="size-5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Download className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                Step 1
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Install on this device
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                We will use the native install prompt where your browser supports it.
                Otherwise, follow the device steps below.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {isInstalled ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200">
                Homzie is already installed on this device.
              </div>
            ) : canPromptInstall ? (
              <Button
                type="button"
                size="lg"
                disabled={isPromptingInstall}
                onClick={async () => {
                  setNotice("");
                  setIsPromptingInstall(true);
                  await promptHomzieInstall();
                  setIsPromptingInstall(false);
                }}
                className="w-full sm:w-fit"
              >
                {isPromptingInstall ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MonitorDown className="size-4" />
                )}
                Install Homzie
              </Button>
            ) : isIos ? (
              <div className="grid gap-3">
                <InstructionStep
                  icon={Share}
                  label="Tap Share in Safari"
                  detail="Use Safari for the smoothest Home Screen install flow on iPhone and iPad."
                />
                <InstructionStep
                  icon={PlusSquare}
                  label="Choose Add to Home Screen"
                  detail="Homzie uses the app manifest name, so the suggested name should already be Homzie."
                />
                <InstructionStep
                  icon={Check}
                  label="Tap Add"
                  detail="Open Homzie from your Home Screen after the icon appears."
                />
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm font-semibold leading-6 text-muted-foreground">
                Your browser has not exposed the install prompt yet. Open Homzie in Chrome,
                Edge, or your browser menu and choose install when available.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                Step 2
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Turn on buyer alerts
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
                Notifications keep realtime buyer activity, messages, offers, and
                listing updates close even when Homzie is not open.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {notificationsEnabled ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200">
                Notifications are enabled for this browser.
              </div>
            ) : notificationsBlocked ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-4 text-sm font-bold text-destructive">
                Notifications are blocked. Enable them in your browser settings, then
                return here.
              </div>
            ) : notificationPermission === "unsupported" ? (
              <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm font-semibold leading-6 text-muted-foreground">
                Notifications are not supported in this browser. On iPhone, install
                Homzie to your Home Screen first, then enable alerts from the installed app.
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isEnablingNotifications}
                onClick={async () => {
                  setNotice("");
                  setIsEnablingNotifications(true);
                  try {
                    await enablePushNotifications();
                    setNotice("Notifications are enabled.");
                  } catch (error) {
                    setNotice(
                      error instanceof Error
                        ? error.message
                        : "Could not enable notifications.",
                    );
                  } finally {
                    setIsEnablingNotifications(false);
                  }
                }}
                className="w-full sm:w-fit"
              >
                {isEnablingNotifications ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Bell className="size-4" />
                )}
                Enable buyer alerts
              </Button>
            )}
            {notice ? (
              <p className="text-xs font-bold text-muted-foreground">{notice}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
          What you get
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            "Realtime buyer activity alerts",
            "Faster access from your Home Screen",
            "Messages and offer updates on this device",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-sm font-bold"
            >
              <Check className="size-4 shrink-0 text-primary" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

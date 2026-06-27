"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  enablePushNotifications,
  getBrowserNotificationStatus,
  type BrowserNotificationStatus,
} from "@/modules/push/components/push-notification-bootstrap";

function statusCopy(status: BrowserNotificationStatus | null, error: string) {
  if (error) return error;
  if (!status) return "Checking this browser's alert status.";

  if (status.status === "blocked") {
    return "Notifications are blocked in your browser settings.";
  }

  if (status.status === "enabled") {
    return "Alerts are enabled and connected for this browser.";
  }

  if (status.status === "not-connected") {
    return "Notifications are allowed, but this browser needs to reconnect.";
  }

  return status.detail;
}

export function EnableNotificationsButton() {
  const [status, setStatus] = useState<BrowserNotificationStatus | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    void getBrowserNotificationStatus().then((nextStatus) => {
      if (isMounted) {
        setStatus(nextStatus);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!status || status.status === "unsupported") return null;

  const isBlocked = status?.status === "blocked";
  const isConnected = status?.status === "enabled";
  const hasPermission = status?.permission === "granted";
  const buttonLabel = isConnected
    ? "Refresh browser alerts"
    : hasPermission
      ? "Connect browser alerts"
      : "Enable browser notifications";

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isPending || isBlocked}
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              const nextStatus = await enablePushNotifications();
              setStatus(nextStatus);
            } catch (nextError) {
              setError(
                nextError instanceof Error
                  ? nextError.message
                  : "Could not enable notifications.",
              );
              setStatus(await getBrowserNotificationStatus());
            }
          });
        }}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bell className="size-4" />
        )}
        {buttonLabel}
      </Button>
      <p className="max-w-md text-xs font-normal text-muted-foreground">
        {statusCopy(status, error)}
      </p>
    </div>
  );
}

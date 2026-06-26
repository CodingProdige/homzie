"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { enablePushNotifications } from "@/modules/push/components/push-notification-bootstrap";

export function EnableNotificationsButton() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    () =>
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "unsupported",
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (permission === "unsupported") return null;

  const isGranted = permission === "granted";

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              await enablePushNotifications();
              setPermission(Notification.permission);
            } catch (nextError) {
              setError(
                nextError instanceof Error
                  ? nextError.message
                  : "Could not enable notifications.",
              );
              setPermission(Notification.permission);
            }
          });
        }}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bell className="size-4" />
        )}
        {isGranted ? "Refresh browser alerts" : "Enable browser notifications"}
      </Button>
      <p className="max-w-md text-xs font-normal text-muted-foreground">
        {permission === "denied"
          ? "Notifications are blocked in your browser settings."
          : error ||
            (isGranted
              ? "Alerts are enabled for this browser. Refresh if this device stops receiving them."
              : "Optional: get alerts for calls and important activity when Homzie is not open.")}
      </p>
    </div>
  );
}

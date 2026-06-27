"use client";

import { useEffect } from "react";

import {
  getWebPushPublicKeyAction,
  saveWebPushSubscriptionAction,
} from "@/modules/push/actions";

export type BrowserNotificationStatus = {
  detail: string;
  permission: NotificationPermission | "unsupported";
  status: "blocked" | "enabled" | "not-connected" | "not-enabled" | "unsupported";
  subscriptionEndpoint: string | null;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function getBrowserNotificationStatus(): Promise<BrowserNotificationStatus> {
  if (!("Notification" in window)) {
    return {
      detail: "This browser does not support notifications.",
      permission: "unsupported",
      status: "unsupported",
      subscriptionEndpoint: null,
    };
  }

  const permission = Notification.permission;

  if (permission === "denied") {
    return {
      detail: "Notifications are blocked in this browser.",
      permission,
      status: "blocked",
      subscriptionEndpoint: null,
    };
  }

  if (permission !== "granted") {
    return {
      detail: "Notifications are not enabled for this browser.",
      permission,
      status: "not-enabled",
      subscriptionEndpoint: null,
    };
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      detail: "This browser cannot receive web push notifications.",
      permission,
      status: "unsupported",
      subscriptionEndpoint: null,
    };
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      return {
        detail: "Alerts are enabled for this browser.",
        permission,
        status: "enabled",
        subscriptionEndpoint: subscription.endpoint,
      };
    }
  } catch {
    return {
      detail: "Homzie could not check this browser's push connection.",
      permission,
      status: "not-connected",
      subscriptionEndpoint: null,
    };
  }

  return {
    detail: "Notifications are allowed, but this browser is not connected yet.",
    permission,
    status: "not-connected",
    subscriptionEndpoint: null,
  };
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser does not support push notifications.");
  }

  const publicKey = await getWebPushPublicKeyAction();
  if (!publicKey) {
    throw new Error("Browser notifications are not configured yet.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(publicKey),
      userVisibleOnly: true,
    }));

  const result = await saveWebPushSubscriptionAction(subscription.toJSON());

  if (!result.ok) {
    throw new Error("Could not save this browser for notifications.");
  }
}

function onIdle(callback: () => void) {
  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 3000 });

    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = globalThis.setTimeout(callback, 1500);

  return () => globalThis.clearTimeout(timeoutId);
}

export function PushNotificationBootstrap() {
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    return onIdle(() => {
      void subscribeToPush().catch((error) => {
        console.warn("[push] could not refresh browser subscription", error);
      });
    });
  }, []);

  return null;
}

export async function enablePushNotifications() {
  if (!("Notification" in window)) {
    throw new Error("This browser does not support notifications.");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notifications were not enabled.");
  }

  await subscribeToPush();
  return getBrowserNotificationStatus();
}

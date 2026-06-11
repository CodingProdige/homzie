"use client";

import { useEffect } from "react";

import {
  getWebPushPublicKeyAction,
  saveWebPushSubscriptionAction,
} from "@/modules/push/actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const publicKey = await getWebPushPublicKeyAction();
  if (!publicKey) return;

  const registration = await navigator.serviceWorker.register("/sw.js");
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(publicKey),
      userVisibleOnly: true,
    }));

  await saveWebPushSubscriptionAction(subscription.toJSON());
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
      subscribeToPush();
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
}

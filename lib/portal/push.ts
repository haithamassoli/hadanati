"use client";

// Web Push opt-in for the parent portal (FR-NOT-2). Subscription is keyed
// server-side by the access code — never a raw studentId.
// The service worker only exists in production builds (Serwist), so every
// step degrades gracefully when there is no registration (dev, unsupported
// browsers, iOS Safari outside the installed PWA).

import { api } from "@/convex/_generated/api";
import { convexClient } from "@/lib/convex";

export type PushResult = "subscribed" | "denied" | "unsupported";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * iOS Safari in the browser (not installed to the home screen) cannot use
 * Web Push at all — the answer there is the A2HS walkthrough.
 */
export function isIosBrowserNotInstalled(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return /iPhone|iPad/.test(navigator.userAgent) && nav.standalone === false;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/** The browser's current push subscription, if any. */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration === undefined) return null;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Opt in to push for the child behind `code`. Must be called from a user
 * gesture (banner/toggle tap) — permission prompts require it.
 */
export async function ensurePushSubscription(code: string): Promise<PushResult> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!isPushSupported() || vapidKey === undefined || vapidKey === "") {
    return "unsupported";
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.getRegistration();
  if (registration === undefined) return "unsupported";

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  const json = subscription.toJSON();
  if (json.endpoint === undefined || json.keys === undefined) {
    return "unsupported";
  }
  await convexClient.mutation(api.pushSubs.subscribe, {
    code,
    subscription: {
      endpoint: json.endpoint,
      ...(json.expirationTime !== undefined && json.expirationTime !== null
        ? { expirationTime: json.expirationTime }
        : {}),
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    },
  });
  return "subscribed";
}

/** Remove this browser's subscription for `code` (server first, then local). */
export async function disablePushSubscription(code: string): Promise<void> {
  const subscription = await getPushSubscription();
  if (subscription === null) return;
  try {
    await convexClient.mutation(api.pushSubs.unsubscribe, {
      code,
      endpoint: subscription.endpoint,
    });
  } catch {
    // Invalid/revoked code: still unsubscribe locally.
  }
  await subscription.unsubscribe();
}

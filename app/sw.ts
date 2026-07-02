/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // defaultCache serves same-origin HTML/RSC navigations NetworkFirst from
  // the "pages" cache, so the app shell loads offline after the first visit.
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// --- Web Push (parent portal) ---
// Payloads carry {type, ...ids} ONLY (FR-NOT-3): titles are static Arabic
// strings per type — zero PII in the notification itself.
const PUSH_TITLES: Record<string, string> = {
  absence: "تنبيه غياب جديد",
  evaluation: "تقييم أسبوعي جديد",
  announcement: "إعلان جديد من الحضانة",
  invoice_issued: "تحديث بخصوص المدفوعات",
  invoice_overdue: "تحديث بخصوص المدفوعات",
};
const PUSH_FALLBACK_TITLE = "تحديث جديد حول طفلك";
const PUSH_BODY = "افتح بوابة أولياء الأمور لعرض التفاصيل";

self.addEventListener("push", (event) => {
  let type = "";
  try {
    type = (event.data?.json() as { type?: string } | undefined)?.type ?? "";
  } catch {
    // Malformed/absent payload: fall back to the generic title.
  }
  event.waitUntil(
    self.registration.showNotification(PUSH_TITLES[type] ?? PUSH_FALLBACK_TITLE, {
      body: PUSH_BODY,
      dir: "rtl",
      lang: "ar",
      icon: "/icons/icon-192.png",
      data: { url: "/portal/inbox" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = "/portal/inbox";
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          try {
            await client.navigate(url);
          } catch {
            // Navigation can be refused (e.g. cross-process); focus is enough.
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

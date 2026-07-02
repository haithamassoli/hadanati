"use client";

import { WifiOff } from "lucide-react";
import { useOutbox } from "@/lib/offline/outbox";
import { useOnline } from "@/lib/offline/use-online";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function OfflineChip() {
  const { t, locale } = useT();
  const { count, syncNow } = useOutbox();
  const online = useOnline();

  if (online && count === 0) {
    return null;
  }

  const pendingCount = new Intl.NumberFormat(
    locale === "ar" ? "ar-JO" : "en-US",
  ).format(count);

  return (
    <div
      data-print-hidden
      className="fixed bottom-20 start-4 z-50 flex flex-col items-start gap-2 md:bottom-4"
    >
      {count > 0 && (
        <div
          data-testid="pending-count"
          data-count={count}
          className="flex items-center gap-2 rounded-full border border-late/30 bg-late-soft py-1 ps-3 pe-1 text-xs font-medium text-late-foreground shadow-sm"
        >
          <span>
            ⏳ {pendingCount} {t("offline.pending")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="rounded-full text-late-foreground hover:bg-late/20"
            data-testid="sync-now"
            onClick={syncNow}
          >
            {t("offline.syncNow")}
          </Button>
        </div>
      )}
      {!online && (
        <div
          data-testid="offline-pill"
          className="flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground shadow-sm"
        >
          <WifiOff className="size-3" />
          {t("offline.offline")}
        </div>
      )}
    </div>
  );
}

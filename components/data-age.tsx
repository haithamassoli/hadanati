"use client";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function relativeAge(updatedAt: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  const seconds = Math.max(1, Math.round((Date.now() - updatedAt) / 1000));
  if (seconds < 60) return rtf.format(-seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

/**
 * Data freshness badge for cached (IndexedDB snapshot) reads.
 * Renders nothing while live; when stale shows a muted
 * "آخر تحديث قبل X" badge with a locale-aware relative time.
 */
export function DataAge({
  updatedAt,
  isStale,
  className,
}: {
  updatedAt?: number;
  isStale: boolean;
  className?: string;
}) {
  const { t, locale } = useT();
  if (!isStale) return null;
  const rel =
    updatedAt !== undefined
      ? relativeAge(updatedAt, locale === "ar" ? "ar-JO" : "en-US")
      : "";
  return (
    <Badge
      variant="secondary"
      data-testid="data-age"
      data-stale="true"
      className={cn("font-normal text-muted-foreground", className)}
    >
      {t("offline.lastUpdated")}
      {rel !== "" ? ` ${rel}` : ""}
    </Badge>
  );
}

/**
 * LWW conflict marker (PRD §8.5): a small amber dot with a
 * "تم التحديث أثناء المزامنة" tooltip, shown on rows whose queued offline
 * write landed after the server row had already changed.
 */
export function ConflictMarker({ show }: { show: boolean }) {
  const { t } = useT();
  if (!show) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-testid="conflict-marker"
            role="img"
            aria-label={t("offline.conflict")}
            title={t("offline.conflict")}
            className="inline-block size-2 shrink-0 rounded-full bg-late"
          />
        </TooltipTrigger>
        <TooltipContent>{t("offline.conflict")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

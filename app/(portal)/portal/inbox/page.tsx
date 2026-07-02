"use client";

// Notification inbox (FR-NOT-1): payloads are type + ids only — the Arabic
// text is derived client-side from type+payload, never stored.

import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarX2,
  CircleAlert,
  Megaphone,
  Receipt,
  Sparkles,
} from "lucide-react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useT, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { localizeNumber } from "@/app/(staff)/students/format";
import { useCodes } from "@/lib/portal/codes";
import { formatRelativeTime } from "@/lib/portal/format";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { DataAge } from "@/components/data-age";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

type T = (key: string) => string;

type InboxItem = FunctionReturnType<typeof api.portal.inbox>[number];

const TYPE_META: Record<
  string,
  { icon: typeof Bell; className: string; href: string }
> = {
  absence: {
    icon: CalendarX2,
    className: "bg-absent-soft text-absent-foreground",
    href: "/portal",
  },
  evaluation: {
    icon: Sparkles,
    className: "bg-present-soft text-present-foreground",
    href: "/portal/progress",
  },
  announcement: {
    icon: Megaphone,
    className: "bg-excused-soft text-excused-foreground",
    href: "/portal/announcements",
  },
  invoice_issued: {
    icon: Receipt,
    className: "bg-late-soft text-late-foreground",
    href: "/portal/payments",
  },
  invoice_overdue: {
    icon: CircleAlert,
    className: "bg-absent-soft text-absent-foreground",
    href: "/portal/payments",
  },
};

/** Arabic/English text derived from type + id-only payload (FR-NOT-3). */
function notificationText(
  type: string,
  payload: Record<string, string>,
  t: T,
  locale: Locale,
): string {
  if (type === "absence" && payload.date !== undefined) {
    return t("portal.inbox.absence").replace("{date}", payload.date);
  }
  if (type === "evaluation" && payload.week !== undefined) {
    const week = Number(payload.week);
    return t("portal.inbox.evaluation").replace(
      "{week}",
      Number.isFinite(week) ? localizeNumber(week, locale) : payload.week,
    );
  }
  if (type === "announcement") {
    return t("portal.inbox.announcement");
  }
  if (type === "invoice_issued") {
    return t("portal.inbox.invoiceIssued");
  }
  if (type === "invoice_overdue") {
    return t("portal.inbox.invoiceOverdue");
  }
  return t("portal.inbox.generic");
}

export default function PortalInboxPage() {
  const { active } = useCodes();
  if (active === null) return null;
  return <Inbox key={active.code} code={active.code} />;
}

function Inbox({ code }: { code: string }) {
  const { t, locale } = useT();
  const router = useRouter();
  const markRead = useMutation(api.portal.markRead);
  const { data, isStale, updatedAt } = useCachedQuery(api.portal.inbox, {
    code,
  });

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  function onOpen(notification: InboxItem) {
    const meta = TYPE_META[notification.type];
    if (notification.readAt === undefined) {
      // Fire-and-forget: navigation shouldn't wait on the ack.
      void markRead({
        code,
        notificationId: notification._id as Id<"notifications">,
      }).catch(() => {});
    }
    router.push(meta?.href ?? "/portal");
  }

  return (
    <div className="flex flex-col gap-4">
      <DataAge updatedAt={updatedAt} isStale={isStale} />
      <h1 className="font-heading text-2xl">{t("portal.inbox.title")}</h1>

      {data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bell />
            </EmptyMedia>
            <EmptyTitle>{t("portal.inbox.empty")}</EmptyTitle>
            <EmptyDescription>{t("portal.inbox.emptyDesc")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((notification) => {
            const meta = TYPE_META[notification.type];
            const Icon = meta?.icon ?? Bell;
            const unread = notification.readAt === undefined;
            return (
              <li key={notification._id}>
                <button
                  type="button"
                  onClick={() => onOpen(notification)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3.5 text-start transition-colors hover:bg-muted/50",
                    unread ? "bg-card" : "bg-muted/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      meta?.className ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm leading-snug",
                        unread ? "font-medium" : "text-muted-foreground",
                      )}
                    >
                      {notificationText(
                        notification.type,
                        notification.payload,
                        t,
                        locale,
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatRelativeTime(notification._creationTime, locale)}
                    </span>
                  </span>
                  {unread && (
                    <Badge className="shrink-0">{t("portal.inbox.unread")}</Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

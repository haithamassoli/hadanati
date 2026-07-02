"use client";

// Portal home (FR-PAR-1): the parent's daily glance. Child + today's status
// chip, latest evaluation as 4 axis dots, balance only when due.

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, ChevronLeft, Share, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { formatFils } from "@/convex/lib/shared";
import { useT } from "@/lib/i18n";
import { localizeNumber } from "@/app/(staff)/students/format";
import { removeCode, useCodes, type StoredCode } from "@/lib/portal/codes";
import {
  ensurePushSubscription,
  isIosBrowserNotInstalled,
  isPushSupported,
} from "@/lib/portal/push";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { DataAge } from "@/components/data-age";
import { EVAL_AXES } from "@/components/progress-chart";
import { StatusChip, type ChipStatus } from "@/components/status-chip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeEntryScreen } from "./code-entry";

const CHIP_STATUSES = ["present", "absent", "late", "excused"] as const;

function chipStatus(status: string | undefined): ChipStatus {
  return (CHIP_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as ChipStatus)
    : "unmarked";
}

export default function PortalHomePage() {
  const { codes, active } = useCodes();
  if (codes.length === 0 || active === null) {
    return <CodeEntryScreen />;
  }
  return <PortalHome key={active.code} entry={active} />;
}

function PortalHome({ entry }: { entry: StoredCode }) {
  const { t, locale } = useT();
  const { data, isStale, updatedAt } = useCachedQuery(api.portal.home, {
    code: entry.code,
  });

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  // Loaded but null → the code was revoked/regenerated.
  if (data === null) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-xs text-balance text-muted-foreground">
          {t("portal.home.invalidCode")}
        </p>
        <Button variant="outline" onClick={() => removeCode(entry.code)}>
          {t("portal.home.removeCode")}
        </Button>
      </div>
    );
  }

  const attendance = data.todayAttendance;
  const evaluation = data.latestEvaluation;

  return (
    <div className="flex flex-col gap-4">
      <DataAge updatedAt={updatedAt} isStale={isStale} />

      {/* Child header */}
      <div className="flex items-center gap-3.5">
        <Avatar className="size-16 text-2xl">
          {data.student.photoUrl !== null && (
            <AvatarImage src={data.student.photoUrl} alt={data.student.nameAr} />
          )}
          <AvatarFallback className="bg-primary/10 font-heading text-primary">
            {data.student.nameAr.trim().charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl leading-tight">
            {data.student.nameAr}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {data.classroomName !== null
              ? `${data.classroomName} · ${data.nurseryName}`
              : data.nurseryName}
          </p>
        </div>
      </div>

      <PushBanner code={entry.code} />

      {/* Today's attendance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-muted-foreground">
            {t("portal.home.todayTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <StatusChip
            status={chipStatus(attendance?.status)}
            className="min-h-12 px-5 text-base"
          />
          {attendance?.checkInAt !== undefined && (
            <span className="text-sm text-muted-foreground">
              {t("portal.home.checkInAt")}{" "}
              <span dir="ltr" className="tabular-nums">
                {new Date(attendance.checkInAt).toLocaleTimeString(
                  locale === "ar" ? "ar-JO" : "en-US",
                  { hour: "2-digit", minute: "2-digit" },
                )}
              </span>
            </span>
          )}
          {attendance?.note !== undefined && attendance.note.trim() !== "" && (
            <p className="w-full text-sm text-muted-foreground">
              {attendance.note}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Latest evaluation — 4 mini axis dots */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base text-muted-foreground">
            {t("portal.home.evalTitle")}
          </CardTitle>
          {evaluation !== null && (
            <span className="text-xs text-muted-foreground">
              {t("portal.home.evalWeek").replace(
                "{n}",
                localizeNumber(evaluation.week, locale),
              )}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {evaluation === null ? (
            <p className="text-sm text-muted-foreground">
              {t("portal.home.noEval")}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {EVAL_AXES.map((axis) => (
                  <div
                    key={axis.key}
                    className="flex flex-col items-center gap-1.5 rounded-xl bg-muted/40 py-3"
                  >
                    <span
                      aria-hidden
                      className="flex size-9 items-center justify-center rounded-full font-heading text-base text-white"
                      style={{ backgroundColor: axis.color }}
                    >
                      {localizeNumber(evaluation.scores[axis.key], locale)}
                    </span>
                    <span className="text-[0.65rem] text-muted-foreground">
                      {t(`evaluations.axis.${axis.key}`)}
                    </span>
                  </div>
                ))}
              </div>
              {evaluation.note !== undefined && evaluation.note.trim() !== "" && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {evaluation.note}
                </p>
              )}
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="mt-2 -ms-2 text-primary"
              >
                <Link href="/portal/progress">
                  {t("portal.home.viewProgress")}
                  <ChevronLeft className="rtl:rotate-0 ltr:rotate-180" data-icon="inline-end" />
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Balance — only when something is due; taps through to payments */}
      {data.balanceFils > 0 && (
        <Link href="/portal/payments" className="block">
          <Card className="border-late/40 bg-late-soft/40 transition-colors hover:bg-late-soft/60">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-late-soft text-late-foreground">
                <Wallet className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">
                  {t("portal.home.balanceTitle")}
                </p>
                <p className="font-heading text-xl text-late-foreground">
                  {formatFils(data.balanceFils, locale)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("portal.home.balanceDesc")}
                </p>
              </div>
              <ChevronLeft
                className="size-5 shrink-0 text-late-foreground rtl:rotate-0 ltr:rotate-180"
                aria-hidden
              />
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}

// --- Push opt-in banner (dismissable, localStorage flag) ---

const DISMISS_KEY = "hadanati.pushBannerDismissed";
const dismissListeners = new Set<() => void>();

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return true;
  }
}

function subscribeDismissed(cb: () => void) {
  dismissListeners.add(cb);
  return () => {
    dismissListeners.delete(cb);
  };
}

/** "ios" (A2HS needed) | "push" (can prompt) | null. Client-only snapshot. */
function readBannerMode(): "push" | "ios" | null {
  if (isIosBrowserNotInstalled()) return "ios";
  if (isPushSupported() && Notification.permission === "default") return "push";
  return null;
}

function PushBanner({ code }: { code: string }) {
  const { t } = useT();
  const router = useRouter();
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    readDismissed,
    () => true,
  );
  // Also re-read after dismiss/enable events (shared listener set).
  const mode = useSyncExternalStore(
    subscribeDismissed,
    readBannerMode,
    () => null,
  );
  const [enabling, setEnabling] = useState(false);

  const visible = dismissed ? null : mode;
  if (visible === null) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore: banner just reappears next visit.
    }
    for (const cb of dismissListeners) cb();
  }

  async function enable() {
    setEnabling(true);
    try {
      const result = await ensurePushSubscription(code);
      if (result === "subscribed") {
        toast.success(t("portal.push.enabled"));
        dismiss();
      } else if (result === "denied") {
        toast.error(t("portal.push.denied"));
        dismiss();
      } else {
        toast.info(t("portal.push.unsupported"));
      }
    } catch {
      toast.error(t("portal.push.unsupported"));
    } finally {
      setEnabling(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {visible === "ios" ? (
          <Share className="size-5" />
        ) : (
          <BellRing className="size-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {visible === "ios"
            ? t("portal.push.iosBannerTitle")
            : t("portal.push.bannerTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {visible === "ios"
            ? t("portal.push.iosBannerDesc")
            : t("portal.push.bannerDesc")}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {visible === "ios" ? (
          <Button size="sm" onClick={() => router.push("/portal/settings")}>
            {t("portal.push.iosHow")}
          </Button>
        ) : (
          <Button size="sm" disabled={enabling} onClick={enable}>
            {t("portal.push.enable")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={dismiss}
        >
          {t("portal.push.later")}
        </Button>
      </div>
    </div>
  );
}

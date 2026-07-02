"use client";

import Link from "next/link";
import { CalendarCheck, PartyPopper, UserX } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useT } from "@/lib/i18n";
import { todayISO } from "@/convex/lib/shared";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { cn } from "@/lib/utils";
import { DataAge } from "@/components/data-age";
import { WeekRibbon } from "@/components/week-ribbon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

type StatusKey = "present" | "absent" | "late" | "excused" | "unmarked";

const STAT_CARDS: Array<{
  status: StatusKey;
  labelKey: string;
  cardClass: string;
  dotClass: string;
}> = [
  {
    status: "present",
    labelKey: "attendance.present",
    cardClass: "border-present/30 bg-present-soft",
    dotClass: "bg-present",
  },
  {
    status: "absent",
    labelKey: "attendance.absent",
    cardClass: "border-absent/30 bg-absent-soft",
    dotClass: "bg-absent",
  },
  {
    status: "late",
    labelKey: "attendance.late",
    cardClass: "border-late/30 bg-late-soft",
    dotClass: "bg-late",
  },
  {
    status: "excused",
    labelKey: "attendance.excused",
    cardClass: "border-excused/30 bg-excused-soft",
    dotClass: "bg-excused",
  },
  {
    // Unmarked: amber-muted — late (amber) soft tone, dashed to read as "todo".
    status: "unmarked",
    labelKey: "dashboard.unmarked",
    cardClass: "border-dashed border-late/40 bg-late-soft/50",
    dotClass: "bg-late/50",
  },
];

const BAR_SEGMENTS: Array<{ status: StatusKey; barClass: string }> = [
  { status: "present", barClass: "bg-present" },
  { status: "late", barClass: "bg-late" },
  { status: "excused", barClass: "bg-excused" },
  { status: "absent", barClass: "bg-absent" },
  { status: "unmarked", barClass: "bg-muted-foreground/20" },
];

export default function DashboardPage() {
  const { t, locale } = useT();
  const mine = useCachedQuery(api.nurseries.getMine, {});
  const today = todayISO();
  const [y, m, d] = today.split("-").map(Number);
  const todayDate = new Date(Date.UTC(y, m - 1, d));
  const todayLabel = new Intl.DateTimeFormat(
    locale === "ar" ? "ar-JO" : "en-US",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(todayDate);
  const isWeekend = todayDate.getUTCDay() === 5 || todayDate.getUTCDay() === 6;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
      <header>
        {mine.data === undefined ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="text-2xl">
            {t("dashboard.greeting")}
            {mine.data ? ` — ${mine.data.nursery.name}` : ""}
          </h1>
        )}
        <p className="mt-1 text-sm text-muted-foreground">{todayLabel}</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("dashboard.week")}
        </h2>
        <WeekRibbon selectedDate={today} />
      </section>

      {isWeekend && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3">
            <PartyPopper className="size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">{t("dashboard.weekend")}</p>
              <p className="text-sm text-muted-foreground">
                {t("dashboard.weekendDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {mine.data ? (
        <Overview
          nursery={mine.data.nursery}
          date={today}
          isWeekend={isWeekend}
        />
      ) : mine.data === undefined ? (
        <OverviewSkeleton />
      ) : null}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
  );
}

function Overview({
  nursery,
  date,
  isWeekend,
}: {
  nursery: Doc<"nurseries">;
  date: string;
  isWeekend: boolean;
}) {
  const { t, locale } = useT();
  const fmt = new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US");
  const overview = useCachedQuery(api.dashboard.todayOverview, {
    nurseryId: nursery._id,
    date,
  });

  if (overview.data === undefined) {
    return <OverviewSkeleton />;
  }

  const { totals, classrooms, absentees } = overview.data;
  const marked = totals.present + totals.absent + totals.late + totals.excused;

  if (marked === 0 && !isWeekend) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarCheck />
          </EmptyMedia>
          <EmptyTitle>{t("dashboard.emptyDay")}</EmptyTitle>
          <EmptyDescription>{t("dashboard.emptyDayDesc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/attendance">{t("dashboard.startAttendance")}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (marked === 0) {
    // Weekend with no data: the weekend note above is enough.
    return null;
  }

  return (
    <>
      <DataAge
        isStale={overview.isStale}
        updatedAt={overview.updatedAt}
        className="self-start"
      />
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STAT_CARDS.map(({ status, labelKey, cardClass, dotClass }) => (
          <div
            key={status}
            className={cn("rounded-xl border p-3", cardClass)}
          >
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span aria-hidden className={cn("size-2 rounded-full", dotClass)} />
              {t(labelKey)}
            </p>
            <p className="mt-1 font-heading text-2xl text-foreground">
              {fmt.format(totals[status])}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("dashboard.classrooms")} — {fmt.format(totals.students)}{" "}
          {t("dashboard.totalStudents")}
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {classrooms.map((classroom) => {
            const classroomMarked =
              classroom.present +
              classroom.late +
              classroom.excused +
              classroom.absent;
            return (
              <Link
                key={classroom.classroomId}
                href="/attendance"
                className="flex flex-col gap-2 rounded-xl border bg-card p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {classroom.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {classroom.stageName}
                  </span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {BAR_SEGMENTS.map(({ status, barClass }) =>
                    classroom[status] > 0 ? (
                      <div
                        key={status}
                        className={barClass}
                        style={{ flexGrow: classroom[status] }}
                      />
                    ) : null,
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.marked")} {fmt.format(classroomMarked)}{" "}
                  {t("dashboard.of")} {fmt.format(classroom.total)}
                  {classroom.absent > 0 && (
                    <>
                      {" · "}
                      <span className="text-absent">
                        {fmt.format(classroom.absent)} {t("attendance.absent")}
                      </span>
                    </>
                  )}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <UserX className="size-4 text-absent" />
            {t("dashboard.absentees")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {absentees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("dashboard.noAbsentees")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {absentees.map((absentee) => (
                <li
                  key={absentee.studentId}
                  className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {absentee.nameAr}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {absentee.classroomName}
                    </span>
                  </div>
                  {absentee.note && (
                    <p className="text-xs text-muted-foreground">
                      {absentee.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

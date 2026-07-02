"use client";

// Progress (FR-PAR-2): the 4-axis chart over the full year + latest per-axis
// scores as friendly tiles.

import { TrendingUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useT } from "@/lib/i18n";
import { localizeNumber } from "@/app/(staff)/students/format";
import { useCodes } from "@/lib/portal/codes";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { DataAge } from "@/components/data-age";
import { EVAL_AXES, ProgressChart } from "@/components/progress-chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalProgressPage() {
  const { active } = useCodes();
  if (active === null) return null;
  return <Progress key={active.code} code={active.code} />;
}

function Progress({ code }: { code: string }) {
  const { t, locale } = useT();
  const { data, isStale, updatedAt } = useCachedQuery(api.portal.progress, {
    code,
  });

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => a.week - b.week);
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const chartData = sorted.map((row) => ({ week: row.week, ...row.scores }));

  return (
    <div className="flex flex-col gap-4">
      <DataAge updatedAt={updatedAt} isStale={isStale} />

      <div>
        <h1 className="font-heading text-2xl">{t("portal.progress.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("portal.progress.desc")}
        </p>
      </div>

      {sorted.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrendingUp />
            </EmptyMedia>
            <EmptyTitle>{t("portal.progress.empty")}</EmptyTitle>
            <EmptyDescription>{t("portal.progress.emptyDesc")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {latest !== null && (
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-base text-muted-foreground">
                  {t("portal.progress.latestTitle")}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {t("portal.progress.latestWeek").replace(
                    "{n}",
                    localizeNumber(latest.week, locale),
                  )}
                </span>
              </CardHeader>
              <CardContent className="grid grid-cols-4 gap-2">
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
                      {localizeNumber(latest.scores[axis.key], locale)}
                    </span>
                    <span className="text-[0.65rem] text-muted-foreground">
                      {t(`evaluations.axis.${axis.key}`)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-2">
              <ProgressChart data={chartData} height={280} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

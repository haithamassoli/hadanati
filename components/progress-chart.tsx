"use client";

import { TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT } from "@/lib/i18n";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** Evaluation axes in canonical order, mapped to the chart design tokens. */
export const EVAL_AXES = [
  { key: "academic", color: "var(--chart-1)" },
  { key: "social", color: "var(--chart-2)" },
  { key: "motor", color: "var(--chart-3)" },
  { key: "behavioral", color: "var(--chart-4)" },
] as const;

export type EvalAxis = (typeof EVAL_AXES)[number]["key"];

export type ProgressPoint = {
  week: number;
  academic?: number | null;
  social?: number | null;
  motor?: number | null;
  behavioral?: number | null;
};

/**
 * A student's weekly evaluation progress — 4 lines (one per axis) over
 * academic weeks, scores 1–5. RTL-aware: in Arabic the weeks axis is
 * reversed so time reads right-to-left.
 */
export function ProgressChart({
  data,
  height = 260,
}: {
  data: ProgressPoint[];
  height?: number;
}) {
  const { t, locale } = useT();
  const fmt = new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-US");
  const isRtl = locale === "ar";

  const hasData = data.some((point) =>
    EVAL_AXES.some((axis) => point[axis.key] != null),
  );
  if (!hasData) {
    return (
      <Empty className="border" style={{ minHeight: height }}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TrendingUp />
          </EmptyMedia>
          <EmptyTitle>{t("evaluations.chartEmpty")}</EmptyTitle>
          <EmptyDescription>{t("evaluations.chartEmptyDesc")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // The SVG plot is laid out LTR and the week axis is mirrored explicitly,
  // so an ancestor dir="rtl" can't double-flip it.
  return (
    <div dir="ltr" className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 8, bottom: 0, left: 8, right: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="week"
            reversed={isRtl}
            tickFormatter={(week: number) => fmt.format(week)}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickMargin={6}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            orientation={isRtl ? "right" : "left"}
            width={30}
            tickFormatter={(score: number) => fmt.format(score)}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => fmt.format(Number(value))}
            labelFormatter={(week) =>
              `${t("evaluations.week")} ${fmt.format(Number(week))}`
            }
            contentStyle={{
              backgroundColor: "var(--popover)",
              color: "var(--popover-foreground)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              direction: isRtl ? "rtl" : "ltr",
            }}
          />
          <Legend
            iconType="plainline"
            iconSize={14}
            wrapperStyle={{ fontSize: 12, direction: isRtl ? "rtl" : "ltr" }}
          />
          {EVAL_AXES.map((axis) => (
            <Line
              key={axis.key}
              type="monotone"
              dataKey={axis.key}
              name={t(`evaluations.axis.${axis.key}`)}
              stroke={axis.color}
              strokeWidth={2}
              connectNulls
              dot={{ r: 3, fill: axis.color, strokeWidth: 0 }}
              activeDot={{ r: 4.5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

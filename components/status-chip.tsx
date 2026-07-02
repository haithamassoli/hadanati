"use client";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ChipStatus = "present" | "absent" | "late" | "excused" | "unmarked";

const SET_CLASSES: Record<Exclude<ChipStatus, "unmarked">, string> = {
  present: "bg-present-soft text-present-foreground ring-2 ring-present",
  absent: "bg-absent-soft text-absent-foreground ring-2 ring-absent",
  late: "bg-late-soft text-late-foreground ring-2 ring-late",
  excused: "bg-excused-soft text-excused-foreground ring-2 ring-excused",
};

const DOT_CLASSES: Record<Exclude<ChipStatus, "unmarked">, string> = {
  present: "bg-present",
  absent: "bg-absent",
  late: "bg-late",
  excused: "bg-excused",
};

/**
 * Attendance status chip. `md` keeps a ≥44px tap target for phone use.
 * Set statuses get a soft token background + strong ring; `unmarked` is a
 * dashed muted outline. Renders a <button> when `onClick` is given.
 */
export function StatusChip({
  status,
  onClick,
  size = "md",
  showLabel = true,
  className,
}: {
  status: ChipStatus;
  onClick?: () => void;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const label = t(`attendance.${status}`);
  const classes = cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-1.5 rounded-full font-medium transition-all",
    size === "md"
      ? "min-h-11 min-w-11 px-3.5 text-sm"
      : "min-h-7 min-w-7 px-2.5 text-xs",
    status === "unmarked"
      ? "border-2 border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground"
      : SET_CLASSES[status],
    onClick !== undefined && "cursor-pointer",
    className,
  );
  const content = (
    <>
      {status !== "unmarked" && (
        <span
          aria-hidden
          className={cn(
            "rounded-full",
            size === "md" ? "size-2" : "size-1.5",
            DOT_CLASSES[status],
          )}
        />
      )}
      {showLabel && <span>{label}</span>}
    </>
  );
  if (onClick !== undefined) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={showLabel ? undefined : label}
        data-status={status}
        className={classes}
      >
        {content}
      </button>
    );
  }
  return (
    <span
      aria-label={showLabel ? undefined : label}
      data-status={status}
      className={classes}
    >
      {content}
    </span>
  );
}

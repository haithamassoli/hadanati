"use client";

// The attendance "status quartet" — the app's signature motif. Reuses the real
// StatusChip so the labels (including excused → "معذور") come straight from the
// shipped attendance.* dictionary and always match the product.

import { StatusChip } from "@/components/status-chip";
import { cn } from "@/lib/utils";

export const QUARTET = ["present", "absent", "late", "excused"] as const;

export function QuartetLegend({
  size = "sm",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {QUARTET.map((status) => (
        <StatusChip key={status} status={status} size={size} />
      ))}
    </div>
  );
}

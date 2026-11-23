import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export type PriceChangeProps = {
  /** Percent change; positive = price up (bad for kitchen cost) */
  percent: number | null | undefined;
  className?: string;
};

/**
 * Price delta with color + arrow + sign (not color-only).
 * Up (cost increase) = danger/red. Down = success/green.
 */
export function PriceChange({ percent, className }: PriceChangeProps) {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm text-muted", className)}>
        <Minus className="size-3.5" aria-hidden="true" />
        <span>—</span>
      </span>
    );
  }

  const direction = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  const Icon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium tabular-nums",
        direction === "up" && "text-danger-text",
        direction === "down" && "text-success",
        direction === "flat" && "text-muted",
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {direction === "up" ? "+" : direction === "down" ? "−" : ""}
        {formatPercent(Math.abs(percent), { fractionDigits: 1 })}
      </span>
      <span className="sr-only">
        {direction === "up"
          ? "rast cene"
          : direction === "down"
            ? "pad cene"
            : "bez promene"}
      </span>
    </span>
  );
}

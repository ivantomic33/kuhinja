import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";

export type UsageStripProps = {
  label: string;
  used: number;
  max: number;
  /** Unlimited plan — shows used · bez limita */
  isPremium?: boolean;
  /** Badge text (Free / Starter / Pro…) */
  planLabel?: string;
  className?: string;
};

export function UsageStrip({
  label,
  used,
  max,
  isPremium = false,
  planLabel,
  className,
}: UsageStripProps) {
  if (isPremium) {
    return (
      <div
        className={cn(
          "mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3",
          className
        )}
      >
        <Badge variant="accent">{planLabel ?? "Premium"}</Badge>
        <p className="text-ui-sm text-text-2">
          {label}:{" "}
          <span className="font-semibold tabular-nums text-text">
            {used} · bez limita
          </span>
        </p>
      </div>
    );
  }

  const safeMax = Math.max(1, max);
  const pct = Math.min(100, (used / safeMax) * 100);
  const over = used > max;

  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3",
        over && "border-warning/40",
        className
      )}
    >
      <Badge variant="neutral">{planLabel ?? "Free"}</Badge>
      <p className="text-ui-sm text-text-2">
        {label}:{" "}
        <span className="font-semibold tabular-nums text-text">
          {used} / {max}
        </span>
      </p>
      <div className="progress min-w-[120px] max-w-[360px] flex-1">
        <span style={{ width: `${pct}%` }} />
      </div>
      <Link
        href="/premium"
        className="ml-auto text-ui-sm font-semibold text-accent no-underline hover:underline"
      >
        Povećaj limit
      </Link>
    </div>
  );
}

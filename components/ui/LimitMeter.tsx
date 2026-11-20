import Link from "next/link";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { ProgressBar } from "./ProgressBar";

export type LimitMeterProps = {
  /** Used count */
  used: number;
  /** Max for free plan */
  max: number;
  /** Label e.g. Recepti */
  label: string;
  /** Premium users see unlimited copy */
  isPremium?: boolean;
  /** Show upgrade CTA when near/at limit */
  showUpgrade?: boolean;
  className?: string;
};

export function LimitMeter({
  used,
  max,
  label,
  isPremium = false,
  showUpgrade = true,
  className,
}: LimitMeterProps) {
  if (isPremium) {
    return (
      <p className={cn("text-xs text-muted", className)}>
        {label}: {sr.create.ingredient.limitPremium}
      </p>
    );
  }

  const safeMax = Math.max(1, max);
  const pct = (used / safeMax) * 100;
  const near = used >= max - 1 || pct >= 80;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {label}:{" "}
          <span className="font-medium tabular-nums text-text">
            {used} {sr.create.ingredient.limitFreeOf} {max}
          </span>
        </p>
        {showUpgrade && near ? (
          <Link
            href="/premium"
            className="text-xs font-medium text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            {sr.settings.upgrade}
          </Link>
        ) : null}
      </div>
      <ProgressBar value={pct} warnNearLimit />
    </div>
  );
}

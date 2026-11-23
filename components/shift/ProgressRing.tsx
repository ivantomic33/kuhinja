"use client";

import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type ProgressRingProps = {
  done: number;
  total: number;
  className?: string;
  size?: number;
  strokeWidth?: number;
};

export function ProgressRing({
  done,
  total,
  className,
  size = 120,
  strokeWidth = 10,
}: ProgressRingProps) {
  const safeTotal = Math.max(total, 0);
  const safeDone = Math.min(Math.max(done, 0), safeTotal || 0);
  const progress = safeTotal === 0 ? 0 : safeDone / safeTotal;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  return (
    <div
      className={cn(
        "relative mx-auto flex items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${sr.shift.progress}: ${safeDone} ${sr.shift.progressOf} ${safeTotal}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-text">
          {safeDone}
          <span className="text-base font-medium text-muted">
            /{safeTotal}
          </span>
        </span>
        <span className="text-xs text-muted">{sr.shift.progress}</span>
      </div>
    </div>
  );
}

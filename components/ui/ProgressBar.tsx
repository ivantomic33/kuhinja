import { cn } from "@/lib/utils/cn";

export type ProgressBarTone =
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "empty";

export type ProgressBarProps = {
  value: number;
  label?: string;
  ariaLabel?: string;
  showValue?: boolean;
  warnNearLimit?: boolean;
  tone?: ProgressBarTone;
  className?: string;
  trackClassName?: string;
};

export function ProgressBar({
  value,
  label,
  ariaLabel = label,
  showValue = false,
  warnNearLimit = false,
  tone,
  className,
  trackClassName,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const near = warnNearLimit && clamped >= 80;
  const full = clamped >= 100;

  const resolvedTone: ProgressBarTone =
    tone ?? (full ? "danger" : near ? "warning" : "accent");

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          {label ? <span className="text-text-2">{label}</span> : <span />}
          {showValue ? (
            <span
              className={cn(
                "tabular-nums font-medium",
                resolvedTone === "danger"
                  ? "text-danger"
                  : resolvedTone === "warning"
                    ? "text-warning"
                    : "text-text-2"
              )}
            >
              {Math.round(clamped)}%
            </span>
          ) : null}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
        className={cn("progress", trackClassName)}
      >
        <span
          className={cn(
            resolvedTone === "success" && "tone-success",
            resolvedTone === "warning" && "tone-warning",
            resolvedTone === "danger" && "tone-danger",
            resolvedTone === "empty" && "tone-empty"
          )}
          style={{
            width: resolvedTone === "empty" ? "0%" : `${clamped}%`,
          }}
        />
      </div>
    </div>
  );
}

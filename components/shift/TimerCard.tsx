"use client";

import { Timer, X } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type ActiveTimer = {
  itemId: string;
  label: string;
  endsAt: number;
  totalMs: number;
};

export type TimerCardProps = {
  timer: ActiveTimer;
  now: number;
  onStop: (itemId: string) => void;
};

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TimerCard({ timer, now, onStop }: TimerCardProps) {
  const remaining = Math.max(0, timer.endsAt - now);
  const progress =
    timer.totalMs <= 0 ? 0 : Math.min(1, remaining / timer.totalMs);
  const done = remaining <= 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-surface-2 p-2",
        done && "border-success/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Timer
            className={cn(
              "size-5 shrink-0 text-accent",
              !done && "motion-safe:animate-pulse"
            )}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-text">
              {timer.label}
            </p>
            <p className="text-xs text-muted">
              {done ? sr.shift.timerDone : sr.shift.timerRunning}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 text-xl font-semibold tabular-nums",
            done ? "text-success" : "text-text"
          )}
        >
          {formatRemaining(remaining)}
        </span>
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-surface"
        aria-hidden="true"
      >
        <div
          className={cn(
            "h-full rounded-[var(--radius-pill)] bg-accent",
            "motion-safe:transition-[width] motion-safe:duration-200"
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <PrimaryButton
        variant="ghost"
        className="min-h-[44px] self-end px-2 text-sm"
        leftIcon={<X className="size-4" aria-hidden="true" />}
        onClick={() => onStop(timer.itemId)}
      >
        {sr.shift.stopTimer}
      </PrimaryButton>
    </div>
  );
}

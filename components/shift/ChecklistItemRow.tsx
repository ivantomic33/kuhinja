"use client";

import { Check, Lock, Timer } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { sr } from "@/lib/i18n/sr";
import type { ChecklistItemInput } from "@/lib/schemas/domain";
import { cn } from "@/lib/utils/cn";

export type ChecklistItemRowProps = {
  item: ChecklistItemInput;
  checked: boolean;
  timerActive: boolean;
  timerLocked: boolean;
  onToggle: (itemId: string) => void;
  onStartTimer: (itemId: string) => void;
};

export function ChecklistItemRow({
  item,
  checked,
  timerActive,
  timerLocked,
  onToggle,
  onStartTimer,
}: ChecklistItemRowProps) {
  const hasTimer = typeof item.minutes === "number" && item.minutes > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-surface p-1",
        checked && "border-success/30 bg-surface-2/60"
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-pressed={checked}
        className={cn(
          "flex min-h-[64px] w-full items-center gap-2 rounded-[var(--radius-input)] px-2 py-2 text-left",
          "outline-none transition-opacity",
          "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "active:opacity-90"
        )}
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
            checked
              ? "border-success bg-success text-background"
              : "border-border bg-surface-2 text-transparent"
          )}
          aria-hidden="true"
        >
          <Check className="size-5" strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-lg font-medium leading-snug text-text",
              checked && "text-muted line-through"
            )}
          >
            {item.label}
          </span>
          {hasTimer ? (
            <span className="mt-1 block text-sm text-muted">
              {item.minutes} {sr.shift.minutesShort}
            </span>
          ) : null}
        </span>
      </button>

      {hasTimer ? (
        <div className="px-1 pb-1">
          {timerLocked && !timerActive ? (
            <div
              className="flex min-h-[48px] items-center gap-1 rounded-[var(--radius-input)] border border-border bg-surface-2 px-2 text-sm text-muted"
              role="status"
            >
              <Lock className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                {sr.shift.lockedTimersHint}
              </span>
            </div>
          ) : (
            <PrimaryButton
              variant="ghost"
              fullWidth
              className="min-h-[48px]"
              disabled={timerActive}
              leftIcon={
                <Timer className="size-4" aria-hidden="true" />
              }
              onClick={() => onStartTimer(item.id)}
            >
              {timerActive ? sr.shift.timerRunning : sr.shift.startTimer}
            </PrimaryButton>
          )}
        </div>
      ) : null}
    </div>
  );
}

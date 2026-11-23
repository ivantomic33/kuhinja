"use client";

import { useRef, type ReactNode } from "react";
import { Delete } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type NumericKeypadProps = {
  /** Called with the pressed digit / symbol */
  onKey: (key: string) => void;
  /** Backspace / delete last character */
  onBackspace?: () => void;
  /** Clear entire value */
  onClear?: () => void;
  /** Show decimal key (default true) */
  showDecimal?: boolean;
  /** Decimal character (default ",") */
  decimalChar?: string;
  /** Disable all keys */
  disabled?: boolean;
  className?: string;
};

const DIGITS: string[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

export function NumericKeypad({
  onKey,
  onBackspace,
  onClear,
  showDecimal = true,
  decimalChar = ",",
  disabled = false,
  className,
}: NumericKeypadProps) {
  return (
    <div
      role="group"
      aria-label={sr.ui.numericKeypad.label}
      className={cn("grid grid-cols-3 gap-1", className)}
    >
      {DIGITS.flatMap((row) =>
        row.map((digit) => (
          <Key
            key={digit}
            label={digit}
            ariaLabel={`${sr.ui.numericKeypad.digit} ${digit}`}
            disabled={disabled}
            onPress={() => onKey(digit)}
          />
        ))
      )}

      {showDecimal ? (
        <Key
          label={decimalChar}
          ariaLabel={sr.ui.numericKeypad.decimal}
          disabled={disabled}
          onPress={() => onKey(decimalChar)}
          muted
        />
      ) : (
        <Key
          label="C"
          ariaLabel={sr.ui.numericKeypad.clear}
          disabled={disabled || !onClear}
          onPress={() => onClear?.()}
          muted
        />
      )}

      <Key
        label="0"
        ariaLabel={`${sr.ui.numericKeypad.digit} 0`}
        disabled={disabled}
        onPress={() => onKey("0")}
      />

      <Key
        label={<Delete className="size-6" aria-hidden="true" />}
        ariaLabel={sr.ui.numericKeypad.backspace}
        disabled={disabled || !onBackspace}
        onPress={() => onBackspace?.()}
        muted
        onLongPress={onClear}
      />
    </div>
  );
}

type KeyProps = {
  label: ReactNode;
  ariaLabel: string;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  muted?: boolean;
};

function Key({
  label,
  ariaLabel,
  onPress,
  onLongPress,
  disabled,
  muted,
}: KeyProps) {
  const longPressTimer = useRef<number | null>(null);

  const clearTimer = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onPress}
      onPointerDown={() => {
        if (!onLongPress) return;
        longPressTimer.current = window.setTimeout(() => {
          onLongPress();
          longPressTimer.current = null;
        }, 450);
      }}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      className={cn(
        "inline-flex min-h-[56px] items-center justify-center",
        "rounded-[var(--radius-input)] text-2xl font-semibold tabular-nums",
        "border border-border bg-surface-2 text-text",
        "transition-colors outline-none select-none",
        "enabled:active:bg-surface-3",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:border-dashed",
        muted && "text-muted"
      )}
    >
      {label}
    </button>
  );
}

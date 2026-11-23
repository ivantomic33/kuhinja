"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type BigNumberProps = {
  /** Target value to display */
  value: number;
  /** Fraction digits after animation settles */
  fractionDigits?: number;
  /** Optional prefix (e.g. currency) */
  prefix?: string;
  /** Optional suffix (e.g. %) */
  suffix?: string;
  /** Accessible label — defaults to i18n */
  label?: string;
  /** Locale for number formatting (default: sr-Latn) */
  locale?: string;
  className?: string;
  /** Animation duration in ms (default 180) */
  durationMs?: number;
  /** Visual size scale */
  size?: "sm" | "md" | "lg" | "hero";
};

const SIZE_CLASS = {
  sm: "text-2xl sm:text-3xl",
  md: "text-4xl sm:text-5xl",
  lg: "text-5xl sm:text-6xl",
  hero: "text-6xl sm:text-7xl tracking-tighter",
} as const;

export function BigNumber({
  value,
  fractionDigits = 0,
  prefix = "",
  suffix = "",
  label = sr.ui.bigNumber.label,
  locale = "sr-Latn",
  className,
  durationMs = 180,
  size = "md",
}: BigNumberProps) {
  const immediate = usePrefersReducedMotion() || durationMs <= 0;
  const [display, setDisplay] = useState(value);
  const latest = useRef(value);
  const formatter = useMemo(() => new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }), [locale, fractionDigits]);

  useEffect(() => {
    const from = latest.current;
    if (Object.is(from, value)) return;
    if (immediate || !Number.isFinite(from) || !Number.isFinite(value)) {
      latest.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      latest.current = t < 1 ? from + (value - from) * eased : value;
      setDisplay(latest.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs, immediate]);

  const text = `${prefix}${formatter.format(immediate ? value : display)}${suffix}`;

  return (
    <span
      data-numeric
      className={cn(
        "inline-block max-w-full [overflow-wrap:anywhere] font-semibold tabular-nums tracking-tight text-text",
        SIZE_CLASS[size],
        className
      )}
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">
        {`${label}: ${prefix}${formatter.format(value)}${suffix}`}
      </span>
    </span>
  );
}

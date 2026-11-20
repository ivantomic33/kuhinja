"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
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
  /** Animation duration in ms (default 300) */
  durationMs?: number;
  /** Visual size scale */
  size?: "sm" | "md" | "lg" | "hero";
};

function formatNumber(
  value: number,
  locale: string,
  fractionDigits: number
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

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
  durationMs = 300,
  size = "md",
}: BigNumberProps) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion || durationMs <= 0) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const to = value;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, durationMs, reduceMotion]);

  const text = `${prefix}${formatNumber(display, locale, fractionDigits)}${suffix}`;

  return (
    <span
      data-numeric
      aria-label={`${label}: ${prefix}${formatNumber(value, locale, fractionDigits)}${suffix}`}
      className={cn(
        "inline-block max-w-full [overflow-wrap:anywhere] font-semibold tabular-nums tracking-tight text-text",
        SIZE_CLASS[size],
        className
      )}
    >
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

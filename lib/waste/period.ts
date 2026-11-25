/**
 * Europe/Belgrade calendar helpers for waste reports.
 */

const TZ = "Europe/Belgrade";

const belgradeDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD in Europe/Belgrade for an instant. */
export function belgradeDateString(instant: Date = new Date()): string {
  return belgradeDateFormatter.format(instant);
}

/** First and last calendar day of the Belgrade month containing `instant`. */
export function belgradeMonthBounds(instant: Date = new Date()): {
  from: string;
  to: string;
} {
  const today = belgradeDateString(instant);
  const [y, m] = today.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  // Day 0 of next month = last day of this month (UTC date math on calendar parts).
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function formatBelgradeDateTime(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("sr-Latn", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

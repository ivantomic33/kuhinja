/**
 * Waste report math helpers.
 * Row amounts stay unrounded; totals round once at the end (decision 6).
 */

export type WasteReasonShare = {
  reason: string;
  amount: number;
  percent: number;
};

/** Round to 2 decimal places (RSD display / export totals). */
export function roundRsd(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Net total from unrounded row costs — round once. */
export function sumWasteCosts(rowCosts: readonly number[]): number {
  const raw = rowCosts.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  return roundRsd(raw);
}

/**
 * Reason shares that sum to exactly 100.00.
 * Largest remainder method on 2-decimal percents.
 */
export function reasonShares(
  amountsByReason: Readonly<Record<string, number>>,
): WasteReasonShare[] {
  const entries = Object.entries(amountsByReason)
    .map(([reason, amount]) => ({ reason, amount: Number(amount) || 0 }))
    .filter((row) => row.amount !== 0);

  const total = entries.reduce((sum, row) => sum + row.amount, 0);
  if (total === 0 || entries.length === 0) {
    return entries.map((row) => ({ ...row, percent: 0 }));
  }

  const absTotal = Math.abs(total);
  type Work = WasteReasonShare & { remainder: number };
  const work: Work[] = entries.map((row) => {
    const raw = (Math.abs(row.amount) / absTotal) * 100;
    const floored = Math.floor(raw * 100) / 100;
    return {
      reason: row.reason,
      amount: roundRsd(row.amount),
      percent: floored,
      remainder: raw - floored,
    };
  });

  let allocated = work.reduce((sum, row) => sum + row.percent, 0);
  let leftover = Math.round((100 - allocated) * 100) / 100;
  work.sort((a, b) => b.remainder - a.remainder || b.amount - a.amount);
  let i = 0;
  while (leftover > 0 && work.length > 0) {
    work[i % work.length].percent = Math.round((work[i % work.length].percent + 0.01) * 100) / 100;
    leftover = Math.round((leftover - 0.01) * 100) / 100;
    i += 1;
  }

  return work
    .map(({ reason, amount, percent }) => ({ reason, amount, percent }))
    .sort((a, b) => b.amount - a.amount);
}

/** Format number with Serbian decimal comma for CSV. */
export function formatCsvNumber(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(fractionDigits).replace(".", ",");
}

/** A purchase quantity must be positive. A free purchase has a unit price of zero. */
export function unitPrice(price: number, quantity: number): number | null {
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  const result = price / quantity;
  return Number.isFinite(result) ? result : null;
}

export function priceDifference(current: number, previous: number): number {
  return current - previous;
}

/** A percentage change requires a positive previous price. */
export function priceChangePercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || current < 0 || !Number.isFinite(previous) || previous <= 0) {
    return null;
  }
  const result = (priceDifference(current, previous) / previous) * 100;
  return Number.isFinite(result) ? result : null;
}

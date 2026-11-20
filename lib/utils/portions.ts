/** Serbian portion copy helper. */
export function formatPortions(n: number): string {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (count === 1) return "1 porcija";
  if (count >= 2 && count <= 4) return `${count} porcije`;
  return `${count} porcija`;
}

/**
 * Plain-text purchase order body + WhatsApp phone normalization.
 */

export type PurchaseOrderTextInput = {
  workspaceName: string;
  orderNumber: number;
  status: string;
  supplierName: string | null;
  createdAt: Date | string;
  lines: Array<{
    name: string;
    qty: number;
    unit: string;
  }>;
};

function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("sr-Latn", {
    dateStyle: "medium",
    timeZone: "Europe/Belgrade",
  }).format(d);
}

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  return String(Math.round(qty * 1000) / 1000);
}

/** Digits only for wa.me (strip +, spaces, dashes, parentheses). */
export function normalizePhoneForWa(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function waMeLink(phone: string | null | undefined): string | null {
  const digits = normalizePhoneForWa(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function formatPurchaseOrderText(input: PurchaseOrderTextInput): string {
  const supplier = input.supplierName?.trim() || "Bez dobavljača";
  const header = [
    `Narudžbenica br. ${input.orderNumber}`,
    `Radni prostor: ${input.workspaceName || "TreuPlate"}`,
    `Dobavljač: ${supplier}`,
    `Datum: ${formatDate(input.createdAt)}`,
    `Status: ${input.status}`,
    "",
    "Stavke:",
  ];

  const lines =
    input.lines.length === 0
      ? ["(nema stavki)"]
      : input.lines.map(
          (line, index) =>
            `${index + 1}. ${line.name} — ${formatQty(line.qty)} ${line.unit}`,
        );

  return [...header, ...lines, "", "— TreuPlate"].join("\n");
}

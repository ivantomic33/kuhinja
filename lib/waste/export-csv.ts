import { formatBelgradeDateTime } from "./period";
import { formatCsvNumber, roundRsd } from "./math";

export type WasteExportRow = {
  createdAt: string;
  subjectName: string;
  quantity: number;
  unit: string;
  reason: string;
  unitCostSnapshot: number;
  costRsd: number;
  isCorrection: boolean;
  note: string | null;
};

const HEADERS = [
  "Datum",
  "Sastojak/recept",
  "Količina",
  "Jedinica",
  "Razlog",
  "Cena/jed",
  "Iznos RSD",
  "Ispravka",
  "Napomena",
] as const;

/** UTF-8 BOM + semicolon CSV (sr-Latn Excel). */
export function buildWasteCsv(rows: WasteExportRow[]): string {
  const lines: string[] = [HEADERS.join(";")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsv(formatBelgradeDateTime(row.createdAt)),
        escapeCsv(row.subjectName),
        formatCsvNumber(row.quantity, 3),
        escapeCsv(row.unit),
        escapeCsv(row.reason),
        formatCsvNumber(row.unitCostSnapshot, 4),
        formatCsvNumber(row.costRsd, 6),
        row.isCorrection ? "da" : "ne",
        escapeCsv(row.note ?? ""),
      ].join(";"),
    );
  }
  const total = roundRsd(rows.reduce((sum, row) => sum + row.costRsd, 0));
  lines.push(
    ["", "", "", "", "", "UKUPNO", formatCsvNumber(total, 2), "", ""].join(";"),
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function escapeCsv(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Parse net total from a CSV built by buildWasteCsv (for tests). */
export function parseWasteCsvTotal(csv: string): number {
  const text = csv.replace(/^\uFEFF/, "");
  const lines = text.trim().split(/\r?\n/);
  const last = lines[lines.length - 1] ?? "";
  const parts = last.split(";");
  const raw = (parts[6] ?? "").replace(",", ".");
  return Number(raw) || 0;
}

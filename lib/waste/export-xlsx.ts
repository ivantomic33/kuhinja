import { formatBelgradeDateTime } from "./period";
import { roundRsd } from "./math";
import type { WasteExportRow } from "./export-csv";

export type WasteXlsxInput = {
  workspaceName: string;
  from: string;
  to: string;
  rows: WasteExportRow[];
  totalNet: number;
  reasons: Array<{ reason: string; amount: number }>;
};

/** Server-only XLSX via exceljs (dynamic import). */
export async function buildWasteXlsx(input: WasteXlsxInput): Promise<Uint8Array> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TreuPlate";
  workbook.created = new Date();

  const detail = workbook.addWorksheet("Detalji", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  detail.columns = [
    { header: "Datum", key: "date", width: 18 },
    { header: "Sastojak/recept", key: "name", width: 28 },
    { header: "Količina", key: "qty", width: 12 },
    { header: "Jedinica", key: "unit", width: 10 },
    { header: "Razlog", key: "reason", width: 12 },
    { header: "Cena/jed", key: "unitCost", width: 12 },
    { header: "Iznos RSD", key: "amount", width: 14 },
    { header: "Ispravka", key: "corr", width: 10 },
    { header: "Napomena", key: "note", width: 24 },
  ];

  for (const row of input.rows) {
    detail.addRow({
      date: formatBelgradeDateTime(row.createdAt),
      name: row.subjectName,
      qty: row.quantity,
      unit: row.unit,
      reason: row.reason,
      unitCost: row.unitCostSnapshot,
      amount: row.costRsd,
      corr: row.isCorrection ? "da" : "ne",
      note: row.note ?? "",
    });
  }

  const amountCol = detail.getColumn("amount");
  amountCol.numFmt = '#,##0.00" RSD"';
  const unitCostCol = detail.getColumn("unitCost");
  unitCostCol.numFmt = "#,##0.0000";

  const totalRow = detail.addRow({
    date: "",
    name: "UKUPNO",
    qty: "",
    unit: "",
    reason: "",
    unitCost: "",
    amount: roundRsd(input.totalNet),
    corr: "",
    note: "",
  });
  totalRow.font = { bold: true };

  const summary = workbook.addWorksheet("Zbir po razlozima");
  summary.columns = [
    { header: "Razlog", key: "reason", width: 16 },
    { header: "Iznos RSD", key: "amount", width: 14 },
  ];
  for (const row of input.reasons) {
    summary.addRow({ reason: row.reason, amount: roundRsd(row.amount) });
  }
  summary.getColumn("amount").numFmt = '#,##0.00" RSD"';
  const sumTotal = summary.addRow({
    reason: "UKUPNO",
    amount: roundRsd(input.totalNet),
  });
  sumTotal.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof Uint8Array
    ? buffer
    : new Uint8Array(buffer as ArrayBuffer);
}

/** Read net total from the Detalji sheet UKUPNO row (tests). */
export async function parseWasteXlsxTotal(bytes: Uint8Array): Promise<number> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  // exceljs accepts Buffer-like input
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet("Detalji");
  if (!sheet) return 0;
  let total = 0;
  sheet.eachRow((row) => {
    const name = String(row.getCell(2).value ?? "");
    if (name === "UKUPNO") {
      total = Number(row.getCell(7).value) || 0;
    }
  });
  return total;
}

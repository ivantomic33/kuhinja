import { readFile } from "node:fs/promises";
import path from "node:path";

export type PurchaseOrderPdfInput = {
  workspaceName: string;
  orderNumber: number;
  status: string;
  supplierName: string | null;
  createdAt: Date;
  lines: Array<{ name: string; qty: number; unit: string }>;
};

const FONT_PATH = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "NotoSans-Regular.ttf",
);

/**
 * Build a simple purchase-order PDF (same stack as F2 allergens: pdf-lib + Noto Sans).
 * Server-only; load dynamically from route handlers.
 */
export async function buildPurchaseOrderPdf(
  input: PurchaseOrderPdfInput,
): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  const fontBytes = await readFile(FONT_PATH);
  let font;
  try {
    font = await doc.embedFont(fontBytes, { subset: true });
  } catch {
    try {
      font = await doc.embedFont(fontBytes);
    } catch {
      font = await doc.embedFont(StandardFonts.Helvetica);
    }
  }

  const margin = 48;
  const pageWidth = 595;
  const pageHeight = 842;
  const black = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.35, 0.35, 0.35);
  const lineColor = rgb(0.75, 0.75, 0.75);

  const dateLabel = new Intl.DateTimeFormat("sr-Latn", {
    dateStyle: "medium",
    timeZone: "Europe/Belgrade",
  }).format(input.createdAt);

  const page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  page.drawText(input.workspaceName || "TreuPlate", {
    x: margin,
    y,
    size: 16,
    font,
    color: black,
  });
  y -= 22;
  page.drawText(`Narudžbenica br. ${input.orderNumber}`, {
    x: margin,
    y,
    size: 13,
    font,
    color: black,
  });
  y -= 18;
  page.drawText(`Dobavljač: ${input.supplierName?.trim() || "Bez dobavljača"}`, {
    x: margin,
    y,
    size: 11,
    font,
    color: black,
  });
  y -= 16;
  page.drawText(`Datum: ${dateLabel} · Status: ${input.status}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: muted,
  });
  y -= 20;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: lineColor,
  });
  y -= 24;

  page.drawText("Stavke", {
    x: margin,
    y,
    size: 11,
    font,
    color: black,
  });
  y -= 18;

  if (input.lines.length === 0) {
    page.drawText("Nema stavki.", {
      x: margin,
      y,
      size: 10,
      font,
      color: muted,
    });
  } else {
    for (let i = 0; i < input.lines.length; i += 1) {
      if (y < margin + 40) break;
      const row = input.lines[i];
      const qty = Math.round(row.qty * 1000) / 1000;
      const label = `${i + 1}. ${row.name} — ${qty} ${row.unit}`;
      const text = label.length > 90 ? `${label.slice(0, 89)}…` : label;
      page.drawText(text, {
        x: margin,
        y,
        size: 10,
        font,
        color: black,
        maxWidth: pageWidth - margin * 2,
      });
      y -= 16;
    }
  }

  y = Math.max(margin, y - 12);
  page.drawText("TreuPlate", {
    x: margin,
    y: margin,
    size: 9,
    font,
    color: muted,
  });

  return doc.save();
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatBelgradeDateTime } from "./period";
import { roundRsd } from "./math";
import type { WasteExportRow } from "./export-csv";

export type WastePdfInput = {
  workspaceName: string;
  from: string;
  to: string;
  generatedAt: Date;
  rows: WasteExportRow[];
  totalNet: number;
};

const FONT_PATH = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "NotoSans-Regular.ttf",
);

/** Server-only waste PDF (pdf-lib + Noto Sans, same as F2). */
export async function buildWastePdf(input: WastePdfInput): Promise<Uint8Array> {
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

  const margin = 40;
  const pageWidth = 842;
  const pageHeight = 595;
  const black = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.35, 0.35, 0.35);
  const line = rgb(0.75, 0.75, 0.75);
  const bodySize = 8;
  const headerSize = 7;
  const rowHeight = 14;

  const generated = new Intl.DateTimeFormat("sr-Latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Belgrade",
  }).format(input.generatedAt);

  function drawHeader(page: ReturnType<typeof doc.addPage>, yStart: number) {
    let y = yStart;
    page.drawText(input.workspaceName || "TreuPlate", {
      x: margin,
      y,
      size: 14,
      font,
      color: black,
    });
    y -= 16;
    page.drawText(
      `Otpad · ${input.from} – ${input.to} · generisano ${generated}`,
      { x: margin, y, size: bodySize, font, color: muted },
    );
    y -= 18;
    const cols = [
      { label: "Datum", x: margin },
      { label: "Naziv", x: margin + 90 },
      { label: "Kol.", x: margin + 280 },
      { label: "Jed.", x: margin + 330 },
      { label: "Razlog", x: margin + 370 },
      { label: "Iznos", x: margin + 460 },
      { label: "Ispr.", x: margin + 530 },
    ];
    for (const col of cols) {
      page.drawText(col.label, {
        x: col.x,
        y,
        size: headerSize,
        font,
        color: black,
      });
    }
    y -= 4;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: line,
    });
    return y - 12;
  }

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = drawHeader(page, pageHeight - margin);

  const ensure = () => {
    if (y < margin + 40) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = drawHeader(page, pageHeight - margin);
    }
  };

  if (input.rows.length === 0) {
    page.drawText("Nema unosa u periodu.", {
      x: margin,
      y,
      size: bodySize,
      font,
      color: muted,
    });
  }

  for (const row of input.rows) {
    ensure();
    const name =
      row.subjectName.length > 32
        ? `${row.subjectName.slice(0, 31)}…`
        : row.subjectName;
    const amount = roundRsd(row.costRsd).toFixed(2);
    page.drawText(formatBelgradeDateTime(row.createdAt).slice(0, 16), {
      x: margin,
      y,
      size: bodySize,
      font,
      color: black,
    });
    page.drawText(name, {
      x: margin + 90,
      y,
      size: bodySize,
      font,
      color: black,
      maxWidth: 180,
    });
    page.drawText(String(row.quantity), {
      x: margin + 280,
      y,
      size: bodySize,
      font,
      color: black,
    });
    page.drawText(row.unit, {
      x: margin + 330,
      y,
      size: bodySize,
      font,
      color: black,
    });
    page.drawText(row.reason, {
      x: margin + 370,
      y,
      size: bodySize,
      font,
      color: black,
    });
    page.drawText(amount, {
      x: margin + 460,
      y,
      size: bodySize,
      font,
      color: black,
    });
    page.drawText(row.isCorrection ? "da" : "ne", {
      x: margin + 530,
      y,
      size: bodySize,
      font,
      color: black,
    });
    y -= rowHeight;
  }

  ensure();
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: line,
  });
  y -= 16;
  page.drawText(`Ukupno (neto): ${roundRsd(input.totalNet).toFixed(2)} RSD`, {
    x: margin,
    y,
    size: 11,
    font,
    color: black,
  });

  return doc.save();
}

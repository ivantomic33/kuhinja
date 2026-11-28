import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PDFFont } from "pdf-lib";
import { lineCost, type IngredientLineInput } from "@/lib/calc/foodcost";

export type IngredientExportRow = {
  name: string;
  unit: string;
  price: number;
  wastePercent: number;
  notes: string | null;
};

export type RecipeExportItem = IngredientLineInput & {
  name: string;
};

export type RecipeExportRow = {
  name: string;
  description: string | null;
  portions: number;
  sellingPrice: number;
  costPerPortion: number;
  items: RecipeExportItem[];
};

const currency = new Intl.NumberFormat("sr-Latn", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function buildKitchenCsv(
  scope: "ingredients" | "recipes",
  rows: IngredientExportRow[] | RecipeExportRow[],
): string {
  const headers =
    scope === "ingredients"
      ? ["Sastojak", "Jedinica", "Cena/jedinica (RSD)", "Škart (%)", "Napomena"]
      : [
          "Recept",
          "Opis",
          "Porcije",
          "Prodajna cena (RSD)",
          "Trošak porcije (RSD)",
          "Sastojci",
        ];
  const lines = [headers.map(csvCell).join(";")];

  if (scope === "ingredients") {
    for (const row of rows as IngredientExportRow[]) {
      lines.push(
        [
          row.name,
          row.unit,
          formatNumber(row.price),
          formatNumber(row.wastePercent),
          row.notes ?? "",
        ]
          .map(csvCell)
          .join(";"),
      );
    }
  } else {
    for (const row of rows as RecipeExportRow[]) {
      lines.push(
        [
          row.name,
          row.description ?? "",
          String(row.portions),
          formatNumber(row.sellingPrice),
          formatNumber(row.costPerPortion),
          row.items
            .map((item) => `${item.name}: ${item.quantity} ${item.quantityUnit}`)
            .join(" | "),
        ]
          .map(csvCell)
          .join(";"),
      );
    }
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function formatNumber(value: number): string {
  return currency.format(Number.isFinite(value) ? value : 0);
}

export async function buildKitchenXlsx(
  scope: "ingredients" | "recipes",
  rows: IngredientExportRow[] | RecipeExportRow[],
): Promise<Uint8Array> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TreuPlate";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(
    scope === "ingredients" ? "Sastojci" : "Recepti",
    { views: [{ state: "frozen", ySplit: 1 }] },
  );

  if (scope === "ingredients") {
    sheet.columns = [
      { header: "Sastojak", key: "name", width: 30 },
      { header: "Jedinica", key: "unit", width: 12 },
      { header: "Cena/jedinica (RSD)", key: "price", width: 20 },
      { header: "Škart (%)", key: "waste", width: 12 },
      { header: "Napomena", key: "notes", width: 35 },
    ];
    for (const row of rows as IngredientExportRow[]) {
      sheet.addRow({
        name: row.name,
        unit: row.unit,
        price: row.price,
        waste: row.wastePercent,
        notes: row.notes ?? "",
      });
    }
    sheet.getColumn("price").numFmt = '#,##0.00" RSD"';
    sheet.getColumn("waste").numFmt = '#,##0.00"%"';
  } else {
    sheet.columns = [
      { header: "Recept", key: "name", width: 30 },
      { header: "Opis", key: "description", width: 40 },
      { header: "Porcije", key: "portions", width: 12 },
      { header: "Prodajna cena (RSD)", key: "sellingPrice", width: 20 },
      { header: "Trošak porcije (RSD)", key: "costPerPortion", width: 22 },
      { header: "Sastojci", key: "items", width: 60 },
    ];
    for (const row of rows as RecipeExportRow[]) {
      sheet.addRow({
        name: row.name,
        description: row.description ?? "",
        portions: row.portions,
        sellingPrice: row.sellingPrice,
        costPerPortion: row.costPerPortion,
        items: row.items
          .map((item) => `${item.name}: ${item.quantity} ${item.quantityUnit}`)
          .join(" | "),
      });
    }
    sheet.getColumn("sellingPrice").numFmt = '#,##0.00" RSD"';
    sheet.getColumn("costPerPortion").numFmt = '#,##0.00" RSD"';
  }

  sheet.getRow(1).font = { bold: true };
  const result = await workbook.xlsx.writeBuffer();
  return result instanceof Uint8Array
    ? result
    : new Uint8Array(result as ArrayBuffer);
}

const FONT_PATH = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "NotoSans-Regular.ttf",
);

export async function buildRecipeCardPdf(
  recipe: RecipeExportRow,
): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await readFile(FONT_PATH), { subset: true });
  const width = 595;
  const height = 842;
  const margin = 44;
  const black = rgb(0.12, 0.12, 0.13);
  const muted = rgb(0.35, 0.35, 0.38);
  const border = rgb(0.78, 0.78, 0.8);
  let page = doc.addPage([width, height]);
  let y = height - margin;

  const nextPage = () => {
    page = doc.addPage([width, height]);
    y = height - margin;
    page.drawText(`${recipe.name} · nastavak`, {
      x: margin,
      y,
      size: 12,
      font,
      color: black,
      maxWidth: width - margin * 2,
    });
    y -= 24;
  };
  const ensureSpace = (needed: number) => {
    if (y - needed < margin) nextPage();
  };
  const drawText = (
    text: string,
    size: number,
    color = black,
    maxWidth = width - margin * 2,
  ) => {
    const lines = wrapText(text, font, size, maxWidth);
    for (const line of lines) {
      ensureSpace(size + 5);
      page.drawText(line, { x: margin, y, size, font, color, maxWidth });
      y -= size + 5;
    }
  };

  drawText(recipe.name, 20);
  if (recipe.description) drawText(recipe.description, 10, muted);
  drawText(`Porcije: ${recipe.portions}`, 10);
  drawText(`Prodajna cena: ${formatNumber(recipe.sellingPrice)} RSD`, 10);
  drawText(`Trošak porcije: ${formatNumber(recipe.costPerPortion)} RSD`, 12);
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.6,
    color: border,
  });
  y -= 20;
  drawText("Sastojci", 12);

  for (const item of recipe.items) {
    const cost = lineCost(item);
    drawText(
      `${item.name} · ${item.quantity} ${item.quantityUnit} · ${formatNumber(cost)} RSD`,
      9,
      black,
    );
  }

  const bytes = await doc.save();
  return bytes;
}

function wrapText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

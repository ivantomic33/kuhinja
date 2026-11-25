import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ALLERGEN_CATALOG,
  type AllergenCode,
  type AllergenPresence,
} from "./catalog";
import { ALLERGEN_NOTICE } from "./notice";
import { presenceSymbol } from "./matrix";

export type AllergenPdfRecipe = {
  id: string;
  name: string;
  /** Map allergen code → presence for the recipe total row. */
  totals: Partial<Record<AllergenCode, AllergenPresence>>;
};

export type AllergenPdfInput = {
  workspaceName: string;
  generatedAt: Date;
  recipes: AllergenPdfRecipe[];
};

const FONT_PATH = path.join(
  process.cwd(),
  "assets",
  "fonts",
  "NotoSans-Regular.ttf",
);

/**
 * Build an allergen matrix PDF (multi-page, repeating header).
 * Call only from server code; load this module dynamically (P4).
 */
export async function buildAllergenPdf(
  input: AllergenPdfInput,
): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  const fontBytes = await readFile(FONT_PATH);
  let font;
  try {
    font = await doc.embedFont(fontBytes, { subset: true });
  } catch {
    // Fallback if subsetting fails on the host — still embed full font.
    try {
      font = await doc.embedFont(fontBytes);
    } catch {
      font = await doc.embedFont(StandardFonts.Helvetica);
    }
  }

  const margin = 40;
  const pageWidth = 842; // A4 landscape
  const pageHeight = 595;
  const titleSize = 14;
  const bodySize = 8;
  const headerSize = 7;
  const rowHeight = 16;
  const colCount = 1 + ALLERGEN_CATALOG.length;
  const usableWidth = pageWidth - margin * 2;
  const nameColWidth = 140;
  const allergenColWidth = (usableWidth - nameColWidth) / ALLERGEN_CATALOG.length;

  const black = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.35, 0.35, 0.35);
  const line = rgb(0.75, 0.75, 0.75);

  const dateLabel = new Intl.DateTimeFormat("sr-Latn", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Belgrade",
  }).format(input.generatedAt);

  function drawHeader(page: ReturnType<typeof doc.addPage>, yStart: number) {
    let y = yStart;
    page.drawText(input.workspaceName || "TreuPlate", {
      x: margin,
      y,
      size: titleSize,
      font,
      color: black,
    });
    y -= 18;
    page.drawText(`Matrica alergena · ${dateLabel}`, {
      x: margin,
      y,
      size: bodySize,
      font,
      color: muted,
    });
    y -= 22;

    // Column headers
    let x = margin;
    page.drawText("Recept", {
      x,
      y,
      size: headerSize,
      font,
      color: black,
    });
    x += nameColWidth;
    for (const entry of ALLERGEN_CATALOG) {
      const label = entry.label.length > 12
        ? `${entry.label.slice(0, 11)}…`
        : entry.label;
      page.drawText(label, {
        x,
        y,
        size: headerSize,
        font,
        color: black,
        maxWidth: allergenColWidth - 2,
      });
      x += allergenColWidth;
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

  function ensurePage(state: {
    page: ReturnType<typeof doc.addPage>;
    y: number;
  }) {
    if (state.y < margin + 60) {
      state.page = doc.addPage([pageWidth, pageHeight]);
      state.y = drawHeader(state.page, pageHeight - margin);
    }
  }

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = drawHeader(page, pageHeight - margin);
  const state = { page, y };

  if (input.recipes.length === 0) {
    state.page.drawText("Nema recepata za izvoz.", {
      x: margin,
      y: state.y,
      size: bodySize,
      font,
      color: muted,
    });
    state.y -= rowHeight;
  }

  for (const recipe of input.recipes) {
    ensurePage(state);
    let x = margin;
    const name =
      recipe.name.length > 28 ? `${recipe.name.slice(0, 27)}…` : recipe.name;
    state.page.drawText(name, {
      x,
      y: state.y,
      size: bodySize,
      font,
      color: black,
      maxWidth: nameColWidth - 4,
    });
    x += nameColWidth;
    for (const entry of ALLERGEN_CATALOG) {
      const presence = recipe.totals[entry.code] ?? null;
      const symbol = presenceSymbol(presence);
      if (symbol) {
        state.page.drawText(symbol, {
          x: x + allergenColWidth / 2 - 3,
          y: state.y,
          size: bodySize,
          font,
          color: black,
        });
      }
      x += allergenColWidth;
    }
    state.y -= rowHeight;
  }

  // Notice footer on last page
  ensurePage(state);
  state.y -= 8;
  state.page.drawLine({
    start: { x: margin, y: state.y },
    end: { x: pageWidth - margin, y: state.y },
    thickness: 0.5,
    color: line,
  });
  state.y -= 14;

  const notice = ALLERGEN_NOTICE;
  const maxChars = 110;
  let remaining = notice;
  while (remaining.length > 0) {
    ensurePage(state);
    const chunk =
      remaining.length <= maxChars
        ? remaining
        : remaining.slice(0, maxChars).replace(/\s+\S*$/, "") ||
          remaining.slice(0, maxChars);
    state.page.drawText(chunk.trim(), {
      x: margin,
      y: state.y,
      size: 7,
      font,
      color: muted,
      maxWidth: usableWidth,
    });
    remaining = remaining.slice(chunk.length).trimStart();
    state.y -= 11;
  }

  const bytes = await doc.save();
  return bytes;
}

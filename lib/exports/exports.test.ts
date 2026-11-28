import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import ExcelJS from "exceljs";
import { buildKitchenCsv, buildKitchenXlsx, buildRecipeCardPdf } from "./files";
import { kitchenExportSchema } from "./schemas";

describe("kitchen data exports", () => {
  it("quotes CSV and neutralizes spreadsheet formulas", () => {
    const csv = buildKitchenCsv("ingredients", [
      {
        name: "=HYPERLINK(\"https://example.test\")",
        unit: "kg",
        price: 12.5,
        wastePercent: 2,
        notes: "sa; napomenom",
      },
    ]);

    expect(csv).toContain("'=HYPERLINK(\"\"https://example.test\"\")");
    expect(csv).toContain('"sa; napomenom"');
    expect(csv).toContain("\uFEFF");
  });

  it("writes ingredient rows to a real XLSX workbook", async () => {
    const bytes = await buildKitchenXlsx("ingredients", [
      {
        name: "Brašno",
        unit: "kg",
        price: 120,
        wastePercent: 0,
        notes: null,
      },
    ]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);

    const sheet = workbook.getWorksheet("Sastojci");
    expect(sheet?.getCell("A2").value).toBe("Brašno");
    expect(sheet?.getCell("C2").value).toBe(120);
  });

  it("embeds the local font and creates a recipe card PDF", async () => {
    const bytes = await buildRecipeCardPdf({
      name: "Čorba od šargarepe",
      description: "Dnevna ponuda",
      portions: 2,
      sellingPrice: 500,
      costPerPortion: 123.45,
      items: [
        {
          name: "Šargarepa",
          quantity: 0.5,
          quantityUnit: "kg",
          price: 200,
          priceUnit: "kg",
          lossPercent: 0,
        },
      ],
    });
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});

describe("kitchen export validation", () => {
  const workspaceId = "11111111-1111-4111-8111-111111111111";
  const recipeId = "22222222-2222-4222-8222-222222222222";

  it("requires a recipe ID only for recipe-card PDFs", () => {
    expect(
      kitchenExportSchema.safeParse({
        scope: "recipes",
        format: "pdf",
        workspaceId,
        recipeId,
      }).success,
    ).toBe(true);
    expect(
      kitchenExportSchema.safeParse({
        scope: "ingredients",
        format: "pdf",
        workspaceId,
      }).success,
    ).toBe(false);
    expect(
      kitchenExportSchema.safeParse({
        scope: "recipes",
        format: "csv",
        workspaceId,
        recipeId,
      }).success,
    ).toBe(false);
  });
});

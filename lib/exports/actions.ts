"use server";

import { portionCost, type CalcUnit } from "@/lib/calc/foodcost";
import {
  actionData,
  actionError,
  parseActionInput,
  type ActionResult,
} from "@/lib/server/action";
import { requireWorkspaceMember } from "@/lib/workspace/server";
import {
  buildKitchenCsv,
  buildKitchenXlsx,
  buildRecipeCardPdf,
  type IngredientExportRow,
  type RecipeExportItem,
  type RecipeExportRow,
} from "./files";
import { kitchenExportSchema } from "./schemas";

type ExportFile = {
  fileName: string;
  contentType: string;
  base64: string;
};

type RecipeSourceRow = {
  id: string;
  name: string;
  description: string | null;
  portions: number;
  selling_price: number;
  recipe_items: {
    quantity: number;
    ingredients:
      | {
          name: string;
          unit: string;
          price: number;
          waste_percent: number;
        }
      | {
          name: string;
          unit: string;
          price: number;
          waste_percent: number;
        }[]
      | null;
  }[];
};

const MIME_TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

export async function exportKitchenData(
  input: unknown,
): Promise<ActionResult<ExportFile>> {
  const parsed = parseActionInput(kitchenExportSchema, input);
  if ("error" in parsed) return parsed;

  const member = await requireWorkspaceMember(
    "cook",
    parsed.data.workspaceId,
  );
  if ("error" in member) return member;

  let bytes: Uint8Array;
  let fileBase: string = parsed.data.scope;

  if (parsed.data.scope === "ingredients") {
    const { data, error, count } = await member.supabase
      .from("ingredients")
      .select("name, unit, price, waste_percent, notes", { count: "exact" })
      .eq("workspace_id", member.workspaceId)
      .order("name", { ascending: true })
      .limit(1000);
    if (error) return actionError("INTERNAL_ERROR", error.message);
    if ((count ?? 0) > 1000) {
      return actionError(
        "VALIDATION_ERROR",
        "Izvoz sastojaka je ograničen na 1.000 stavki.",
      );
    }

    const rows: IngredientExportRow[] = (data ?? []).map((row) => ({
      name: row.name,
      unit: row.unit,
      price: Number(row.price) || 0,
      wastePercent: Number(row.waste_percent) || 0,
      notes: row.notes,
    }));
    bytes =
      parsed.data.format === "csv"
        ? new TextEncoder().encode(buildKitchenCsv("ingredients", rows))
        : await buildKitchenXlsx("ingredients", rows);
  } else {
    let query = member.supabase
      .from("recipes")
      .select(
        "id, name, description, portions, selling_price, recipe_items ( quantity, ingredients ( name, unit, price, waste_percent ) )",
        { count: "exact" },
      )
      .eq("workspace_id", member.workspaceId);
    if (parsed.data.recipeId) {
      query = query.eq("id", parsed.data.recipeId);
    }
    query = query.order("name", { ascending: true }).limit(500);

    const { data, error, count } = await query;
    if (error) return actionError("INTERNAL_ERROR", error.message);
    if ((count ?? 0) > 500) {
      return actionError(
        "VALIDATION_ERROR",
        "Izvoz recepata je ograničen na 500 stavki.",
      );
    }

    const sourceRows = (data ?? []) as RecipeSourceRow[];
    if (parsed.data.recipeId && sourceRows.length !== 1) {
      return actionError("NOT_FOUND", "Recept nije pronađen.");
    }

    const rows = sourceRows.map(mapRecipeRow);
    if (parsed.data.format === "pdf") {
      const recipe = rows[0];
      if (!recipe) return actionError("NOT_FOUND", "Recept nije pronađen.");
      fileBase = safeFileName(recipe.name);
      bytes = await buildRecipeCardPdf(recipe);
    } else if (parsed.data.format === "csv") {
      bytes = new TextEncoder().encode(buildKitchenCsv("recipes", rows));
    } else {
      bytes = await buildKitchenXlsx("recipes", rows);
    }
  }

  const fileName = `${fileBase}-${new Date().toISOString().slice(0, 10)}.${parsed.data.format}`;
  return actionData({
    fileName,
    contentType: MIME_TYPES[parsed.data.format],
    base64: Buffer.from(bytes).toString("base64"),
  });
}

function mapRecipeRow(row: RecipeSourceRow): RecipeExportRow {
  const items: RecipeExportItem[] = row.recipe_items.flatMap((item) => {
    const joined = Array.isArray(item.ingredients)
      ? item.ingredients[0]
      : item.ingredients;
    if (!joined) return [];
    if (!isCalcUnit(joined.unit)) {
      throw new Error(`Unknown ingredient unit: ${joined.unit}`);
    }
    return [
      {
        name: joined.name,
        quantity: Number(item.quantity) || 0,
        quantityUnit: joined.unit,
        price: Number(joined.price) || 0,
        priceUnit: joined.unit,
        lossPercent: Number(joined.waste_percent) || 0,
      },
    ];
  });
  const portions = Number(row.portions) || 1;
  const sellingPrice = Number(row.selling_price) || 0;
  const costPerPortion = portionCost(items) / portions;

  return {
    name: row.name,
    description: row.description,
    portions,
    sellingPrice,
    costPerPortion,
    items,
  };
}

function isCalcUnit(value: string): value is CalcUnit {
  return ["g", "kg", "ml", "l", "kom", "pak"].includes(value);
}

function safeFileName(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "recept"
  );
}

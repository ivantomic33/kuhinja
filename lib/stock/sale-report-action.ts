"use server";

import { z } from "zod";
import { getEntitlement } from "@/lib/billing/entitlements";
import { TREBOVANJE_RECIPES_CAP } from "@/lib/recipes/list-params";
import { requireActionUser } from "@/lib/server/action";
import { saleRecipeSelect, summarizeSaleFoodCost, toSaleRecipe, type SaleRecipeRow } from "./saleFoodCost";

const saleReportInput = z.object({
  venueId: z.string().uuid(),
  portions: z.record(z.string().uuid(), z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
    .refine((portions) => Object.keys(portions).length <= TREBOVANJE_RECIPES_CAP),
}).strict();

export async function loadSaleReport(input: unknown) {
  const parsed = saleReportInput.safeParse(input);
  if (!parsed.success) return null;
  const auth = await requireActionUser();
  if ("error" in auth) return null;
  const entitlement = await getEntitlement(auth.supabase, auth.user.id).catch(() => null);
  if (!entitlement?.isPremium) return null;

  const { venueId, portions } = parsed.data;
  const ids = Object.keys(portions);
  if (ids.length === 0) return null;
  const queries = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    queries.push(auth.supabase.from("recipes").select(saleRecipeSelect)
      .eq("venue_id", venueId).in("id", ids.slice(offset, offset + 100)));
  }
  const batches = await Promise.all(queries);
  if (batches.some(({ error }) => error)) return null;
  const rows = batches.flatMap(({ data }) => (data ?? []) as SaleRecipeRow[]);
  if (rows.length !== ids.length) return null;

  const report = summarizeSaleFoodCost(rows.map(toSaleRecipe), portions);
  return entitlement.features.foodCostVariance ? report : { ...report, dishes: [] };
}

import { WasteWorkspace } from "@/components/waste/WasteWorkspace";
import { OfflineCacheSeeder } from "@/components/offline/OfflineCacheSeeder";
import type { CachedIngredient } from "@/lib/offline/cache";
import { getPlan } from "@/lib/supabase/plan-server";
import { createClient, getServerUser } from "@/lib/supabase/server";
import { resolveActiveWorkspace } from "@/lib/workspace/server";
import { belgradeMonthBounds } from "@/lib/waste/period";
import type { WasteEntryRow } from "@/lib/waste/actions";

export default async function WastePage() {
  const supabase = await createClient();
  const [user, plan, workspace] = await Promise.all([
    getServerUser(),
    getPlan(),
    resolveActiveWorkspace(),
  ]);

  const workspaceId = workspace?.workspaceId ?? null;
  const bounds = belgradeMonthBounds();

  let locked = true;
  let canExportCsv = false;
  let canExportPdfXlsx = false;
  let totalNet = 0;
  let totalGross = 0;
  let totalCorrections = 0;
  let reasons: Array<{ reason: string; amount: number }> = [];
  let topIngredients: Array<{ name: string; amount: number }> = [];
  let entries: WasteEntryRow[] = [];
  let ingredients: CachedIngredient[] = [];
  let recipes: Array<{
    id: string;
    name: string;
    venue_id: string;
    portions: number;
    selling_price: number;
    description: string | null;
  }> = [];
  let recipeCosts: Record<string, number> = {};

  if (workspaceId) {
    const [logFeat, csvFeat, pdfFeat, ingredientsRes, recipesRes] = await Promise.all([
      supabase.rpc("workspace_has_feature", {
        p_workspace_id: workspaceId,
        p_feature: "waste_log",
      }),
      supabase.rpc("workspace_has_feature", {
        p_workspace_id: workspaceId,
        p_feature: "waste_export_csv",
      }),
      supabase.rpc("workspace_has_feature", {
        p_workspace_id: workspaceId,
        p_feature: "waste_export_pdf_xlsx",
      }),
      supabase
        .from("ingredients")
        .select("id, venue_id, name, unit, price, waste_percent, notes, version")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true })
        .limit(200),
      supabase
        .from("recipes")
        .select("id, name, venue_id, portions, selling_price, description")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(40),
    ]);

    locked = !logFeat.data;
    canExportCsv = Boolean(csvFeat.data);
    canExportPdfXlsx = Boolean(pdfFeat.data);

    ingredients = ((ingredientsRes.data ?? []) as Array<Record<string, unknown>>).map(
      (row) => ({
        id: String(row.id),
        venue_id: String(row.venue_id ?? ""),
        name: String(row.name ?? ""),
        unit: row.unit as CachedIngredient["unit"],
        price: Number(row.price) || 0,
        waste_percent: Number(row.waste_percent) || 0,
        notes: (row.notes as string | null) ?? null,
        version: row.version == null ? undefined : Number(row.version),
      }),
    );

    recipes = ((recipesRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      venue_id: String(row.venue_id ?? ""),
      portions: Number(row.portions) || 1,
      selling_price: Number(row.selling_price) || 0,
      description: (row.description as string | null) ?? null,
    }));

    if (!locked) {
      const [summaryRes, reportRes, snapRes] = await Promise.all([
        supabase.rpc("waste_report_summary", {
          p_workspace_id: workspaceId,
          p_from: bounds.from,
          p_to: bounds.to,
        }),
        supabase.rpc("waste_report", {
          p_workspace_id: workspaceId,
          p_from: bounds.from,
          p_to: bounds.to,
        }),
        supabase
          .from("recipe_cost_snapshot")
          .select("recipe_id, portion_cost")
          .eq("workspace_id", workspaceId)
          .in(
            "recipe_id",
            recipes.map((r) => r.id),
          ),
      ]);

      const summary = (summaryRes.data ?? {}) as {
        total_net?: number;
        total_gross?: number;
        total_corrections?: number;
        reasons?: Array<{ reason?: string; amount?: number }>;
        top_ingredients?: Array<{ name?: string; amount?: number }>;
      };
      totalNet = Number(summary.total_net) || 0;
      totalGross = Number(summary.total_gross) || 0;
      totalCorrections = Number(summary.total_corrections) || 0;
      reasons = (summary.reasons ?? []).map((row) => ({
        reason: String(row.reason ?? ""),
        amount: Number(row.amount) || 0,
      }));
      topIngredients = (summary.top_ingredients ?? []).map((row) => ({
        name: String(row.name ?? ""),
        amount: Number(row.amount) || 0,
      }));

      entries = ((reportRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.entry_id),
        workspaceId,
        ingredientId: row.ingredient_id ? String(row.ingredient_id) : null,
        recipeId: row.recipe_id ? String(row.recipe_id) : null,
        name: String(row.subject_name ?? ""),
        quantity: Number(row.quantity) || 0,
        unit: String(row.unit ?? ""),
        reason: String(row.reason ?? ""),
        unitCostSnapshot: Number(row.unit_cost_snapshot) || 0,
        costRsd: Number(row.cost_rsd) || 0,
        isCorrection: Boolean(row.is_correction),
        clientId: null,
        createdAt: String(row.created_at ?? ""),
      }));

      recipeCosts = Object.fromEntries(
        ((snapRes.data ?? []) as Array<Record<string, unknown>>)
          .filter((row) => row.portion_cost != null)
          .map((row) => [String(row.recipe_id), Number(row.portion_cost) || 0]),
      );
    }
  }

  return (
    <>
      <OfflineCacheSeeder recipes={recipes} ingredients={ingredients} />
      <WasteWorkspace
        workspaceId={workspaceId}
        workspaceName={workspace?.name ?? "TreuPlate"}
        userId={user?.id ?? ""}
        role={workspace?.role ?? "cook"}
        plan={plan}
        locked={locked}
        canExportCsv={canExportCsv}
        canExportPdfXlsx={canExportPdfXlsx}
        from={bounds.from}
        to={bounds.to}
        totalNet={totalNet}
        totalGross={totalGross}
        totalCorrections={totalCorrections}
        reasons={reasons}
        topIngredients={topIngredients}
        entries={entries}
        ingredients={ingredients}
        recipes={recipes}
        recipeCosts={recipeCosts}
      />
    </>
  );
}

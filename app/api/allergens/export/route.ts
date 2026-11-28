import { z } from "zod";
import { allergenExportQuerySchema } from "@/lib/allergens/schemas";
import type { AllergenCode, AllergenPresence } from "@/lib/allergens/catalog";
import { ALLERGEN_CODES } from "@/lib/allergens/catalog";
import { requireActionUser } from "@/lib/server/action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRecipesParam(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const auth = await requireActionUser();
  if ("error" in auth) {
    return Response.json(auth, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = allergenExportQuerySchema.safeParse({
    recipes: parseRecipesParam(url.searchParams.get("recipes")),
    format: url.searchParams.get("format") ?? "pdf",
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: first?.message ?? "Invalid query.",
        },
      },
      { status: 400 },
    );
  }

  const recipeIds = [...new Set(parsed.data.recipes)];

  const { data: recipes, error: recipesError } = await auth.supabase
    .from("recipes")
    .select("id, name, workspace_id")
    .in("id", recipeIds);

  if (recipesError) {
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: recipesError.message } },
      { status: 500 },
    );
  }

  if (!recipes || recipes.length === 0) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Recepti nisu pronađeni." } },
      { status: 404 },
    );
  }

  const workspaceIds = [
    ...new Set(recipes.map((row) => row.workspace_id as string).filter(Boolean)),
  ];

  for (const workspaceId of workspaceIds) {
    const { data: memberOk } = await auth.supabase.rpc("is_member", {
      p_workspace_id: workspaceId,
      p_min_role: "cook",
    });
    if (!memberOk) {
      return Response.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Nemate pristup ovom radnom prostoru.",
          },
        },
        { status: 403 },
      );
    }

    const { data: hasFeature } = await auth.supabase.rpc("workspace_has_feature", {
      p_workspace_id: workspaceId,
      p_feature: "allergens",
    });
    if (!hasFeature) {
      return Response.json(
        {
          error: {
            code: "UPGRADE_REQUIRED",
            message:
              "Za izvoz alergena potreban je Pro paket vlasnika radnog prostora.",
          },
        },
        { status: 402 },
      );
    }
  }

  const { data: matrixRows, error: matrixError } = await auth.supabase
    .from("recipe_allergens")
    .select("recipe_id, allergen_code, presence")
    .in("recipe_id", recipeIds);

  if (matrixError) {
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: matrixError.message } },
      { status: 500 },
    );
  }

  const totalsByRecipe = new Map<
    string,
    Partial<Record<AllergenCode, AllergenPresence>>
  >();

  for (const row of matrixRows ?? []) {
    const code = row.allergen_code as string;
    const presence = row.presence as string;
    if (!(ALLERGEN_CODES as readonly string[]).includes(code)) continue;
    if (presence !== "contains" && presence !== "trace") continue;
    const map = totalsByRecipe.get(row.recipe_id as string) ?? {};
    map[code as AllergenCode] = presence as AllergenPresence;
    totalsByRecipe.set(row.recipe_id as string, map);
  }

  const workspaceId = recipes[0].workspace_id as string;
  const { data: workspace } = await auth.supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  const { buildAllergenPdf } = await import("@/lib/allergens/pdf");

  const pdfBytes = await buildAllergenPdf({
    workspaceName: workspace?.name ?? "TreuPlate",
    generatedAt: new Date(),
    recipes: recipes.map((recipe) => ({
      id: recipe.id as string,
      name: recipe.name as string,
      totals: totalsByRecipe.get(recipe.id as string) ?? {},
    })),
  });

  const filename = `alergeni-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// Keep zod import used for tree-shaking clarity in some bundlers
void z;

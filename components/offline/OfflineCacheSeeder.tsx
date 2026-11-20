"use client";

import { useEffect, useRef } from "react";
import {
  saveChecklistTemplate,
  saveIngredients,
  saveRecentRecipes,
  saveTemplateSummaries,
  touchRecentRecipe,
  type CachedIngredient,
  type CachedRecipe,
  type CachedTemplate,
  type CachedTemplateSummary,
} from "@/lib/offline/cache";

export type OfflineCacheSeederProps = {
  recipes?: Omit<CachedRecipe, "cachedAt">[];
  recipeDetail?: Omit<CachedRecipe, "cachedAt">;
  ingredients?: CachedIngredient[];
  templates?: CachedTemplateSummary[];
  templateDetail?: Omit<CachedTemplate, "cachedAt">;
};

function fingerprint(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

/** Writes server-fetched domain data into IndexedDB for offline reads. */
export function OfflineCacheSeeder({
  recipes,
  recipeDetail,
  ingredients,
  templates,
  templateDetail,
}: OfflineCacheSeederProps) {
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    // Skip identical payloads (new array refs on every RSC render).
    const key = fingerprint({
      recipes,
      recipeDetail,
      ingredients,
      templates,
      templateDetail,
    });
    if (key === lastKey.current) return;
    lastKey.current = key;

    void (async () => {
      try {
        if (recipes && recipes.length > 0) {
          await saveRecentRecipes(recipes);
        }
        if (recipeDetail) {
          await touchRecentRecipe(recipeDetail);
        }
        if (ingredients && ingredients.length > 0) {
          await saveIngredients(ingredients);
        }
        if (templates && templates.length > 0) {
          await saveTemplateSummaries(templates);
        }
        if (templateDetail) {
          await saveChecklistTemplate(templateDetail);
        }
      } catch {
        // Cache is best-effort.
      }
    })();
  }, [recipes, recipeDetail, ingredients, templates, templateDetail]);

  return null;
}

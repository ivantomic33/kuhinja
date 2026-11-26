"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AllergenNotice } from "@/components/allergens/AllergenNotice";
import { AllergenUpgradePlaceholder } from "@/components/allergens/AllergenUpgradePlaceholder";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import {
  getIngredientAllergens,
  setIngredientAllergens,
} from "@/lib/allergens/actions";
import {
  ALLERGEN_CATALOG,
  type AllergenCode,
  type AllergenPresence,
} from "@/lib/allergens/catalog";
import { sr } from "@/lib/i18n/sr";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils/cn";

type PresenceMap = Partial<Record<AllergenCode, AllergenPresence>>;

export function IngredientAllergenEditor({
  ingredientId,
  venueId,
  className,
}: {
  ingredientId: string;
  venueId?: string | null;
  className?: string;
}) {
  const { toast } = useToast();
  const editorId = useId();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [map, setMap] = useState<PresenceMap>({});

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getIngredientAllergens({ ingredientId });
    if ("error" in result) {
      toast(result.error.message, "danger");
      setLoading(false);
      return;
    }
    setLocked(result.data.locked);
    const next: PresenceMap = {};
    for (const item of result.data.items) {
      next[item.code] = item.presence;
    }
    setMap(next);
    setLoading(false);
  }, [ingredientId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function setPresence(code: AllergenCode, presence: AllergenPresence | null) {
    setMap((prev) => {
      const next = { ...prev };
      if (!presence) {
        delete next[code];
      } else {
        next[code] = presence;
      }
      return next;
    });
  }

  function onSave() {
    startTransition(async () => {
      const items = ALLERGEN_CATALOG.flatMap((entry) => {
        const presence = map[entry.code];
        return presence ? [{ code: entry.code, presence }] : [];
      });
      const result = await setIngredientAllergens({
        ingredientId,
        items,
      });
      if ("error" in result) {
        toast(result.error.message, "danger");
        return;
      }
      toast(sr.allergens.saved, "success");
      // Invalidate recipe lists so recipe matrices refetch without hard reload.
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipes(venueId ?? null) });
      void queryClient.invalidateQueries({ queryKey: ["recipe-allergens"] });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ingredients(venueId ?? null),
      });
    });
  }

  if (loading) {
    return (
      <p role="status" className={cn("text-sm text-muted", className)}>
        {sr.common.loading}
      </p>
    );
  }

  if (locked) {
    return <AllergenUpgradePlaceholder className={className} />;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div>
        <h3 className="text-sm font-semibold text-text">{sr.allergens.ingredientTitle}</h3>
        <p className="text-ui-sm text-text-2">{sr.allergens.ingredientHint}</p>
      </div>

      <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border">
        {ALLERGEN_CATALOG.map((entry) => {
          const current = map[entry.code] ?? null;
          const nameId = `${editorId}-${entry.code}`;
          const containsId = `${nameId}-contains`;
          const traceId = `${nameId}-trace`;
          return (
            <li
              key={entry.code}
              className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <span id={nameId} className="text-sm font-medium text-text">
                <span aria-hidden="true" className="tabular-nums text-text-2">{entry.uredba}.</span>{" "}
                {entry.label}
              </span>
              <div className="flex flex-wrap gap-4">
                <label
                  htmlFor={containsId}
                  className="inline-flex cursor-pointer items-center gap-2 text-ui-sm text-text"
                >
                  <input
                    id={containsId}
                    aria-labelledby={`${containsId}-label ${nameId}`}
                    type="checkbox"
                    className="size-4 rounded border-border-strong"
                    checked={current === "contains"}
                    onChange={(event) => {
                      setPresence(
                        entry.code,
                        event.target.checked ? "contains" : null,
                      );
                    }}
                  />
                  <span id={`${containsId}-label`}>{sr.allergens.contains}</span>
                </label>
                <label
                  htmlFor={traceId}
                  className="inline-flex cursor-pointer items-center gap-2 text-ui-sm text-text"
                >
                  <input
                    id={traceId}
                    aria-labelledby={`${traceId}-label ${nameId}`}
                    type="checkbox"
                    className="size-4 rounded border-border-strong"
                    checked={current === "trace"}
                    onChange={(event) => {
                      setPresence(
                        entry.code,
                        event.target.checked ? "trace" : null,
                      );
                    }}
                  />
                  <span id={`${traceId}-label`}>{sr.allergens.trace}</span>
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton type="button" loading={pending} onClick={onSave}>
          {sr.common.save}
        </PrimaryButton>
      </div>

      <AllergenNotice />
    </div>
  );
}

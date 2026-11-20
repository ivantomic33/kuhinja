"use client";

import { useEffect, useMemo, useState } from "react";
import { Carrot } from "lucide-react";
import { CreateIngredientSheet } from "@/components/create/CreateIngredientSheet";
import { DeleteIngredientButton } from "@/components/create/DeleteIngredientButton";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { BentoCard } from "@/components/ui/BentoCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCardHeader } from "@/components/ui/SectionCardHeader";
import { useOnline } from "@/lib/hooks/useOnline";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import {
  getCachedIngredients,
  type CachedIngredient,
} from "@/lib/offline/cache";
import { FREE_MAX_INGREDIENTS } from "@/lib/plan/limits";
import { formatMoney } from "@/lib/utils/format";

export type IngredientsCardProps = {
  initialIngredients: CachedIngredient[];
  venueId?: string | null;
};

export function IngredientsCard({
  initialIngredients,
  venueId = null,
}: IngredientsCardProps) {
  const online = useOnline(true);
  const { isFree } = usePlan();
  const { showFreeLimit } = usePlanUi();
  const [items, setItems] = useState(initialIngredients);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setItems(initialIngredients);
  }, [initialIngredients]);

  useEffect(() => {
    if (online && initialIngredients.length > 0) return;
    void getCachedIngredients().then((cached) => {
      if (cached.length === 0) return;
      setItems(cached);
    });
  }, [online, initialIngredients.length]);

  const resolvedVenueId = useMemo(() => {
    if (venueId) return venueId;
    return items.find((row) => row.venue_id)?.venue_id ?? null;
  }, [venueId, items]);

  function openCreate() {
    if (isFree && items.length >= FREE_MAX_INGREDIENTS) {
      showFreeLimit("FREE_LIMIT_INGREDIENTS");
      return;
    }
    setOpen(true);
  }

  function handleDeleted(ingredientId: string) {
    setItems((prev) => prev.filter((row) => row.id !== ingredientId));
  }

  const shown = items.slice(0, 8);

  return (
    <>
      <BentoCard
        header={
          <SectionCardHeader
            title={sr.ingredients.title}
            count={items.length}
            href="/ingredients"
            onAdd={openCreate}
            addLabel={sr.create.ingredient.add}
            subtitle="Trenutne cene i škart"
          />
        }
      >
        {shown.length > 0 ? (
          <div className="max-h-80 overflow-auto mise-scroll -mx-6 -mb-6">
            <table className="mise-table">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>Naziv</th>
                  <th>Jedinica</th>
                  <th>Trenutna cena</th>
                  <th>Škart %</th>
                  <th className="hide-sm">Ažurirano</th>
                  <th>
                    <span className="sr-only">Akcije</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-[var(--text-2)]">
                          <Carrot className="size-5" aria-hidden="true" />
                        </span>
                        <span className="font-semibold text-text">{item.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="unit-chip">{item.unit}</span>
                    </td>
                    <td>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(item.price, { fractionDigits: 2 })}
                      </span>{" "}
                      <span className="text-[var(--text-3)]">
                        din/{item.unit}
                      </span>
                    </td>
                    <td className="tabular-nums">
                      {formatMoney(item.waste_percent, { fractionDigits: 0 })}%
                    </td>
                    <td className="hide-sm text-[var(--text-3)]">—</td>
                    <td>
                      <div className="flex justify-end">
                        <DeleteIngredientButton
                          compact
                          ingredientId={item.id}
                          ingredientName={item.name}
                          onDeleted={handleDeleted}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Carrot className="size-7" aria-hidden="true" />}
            title="Još nema sastojaka"
            description="Dodajte prvi sastojak."
            actionLabel="Dodaj sastojak"
            onAction={openCreate}
          />
        )}
      </BentoCard>

      <CreateIngredientSheet
        open={open}
        onClose={() => setOpen(false)}
        venueId={resolvedVenueId}
        currentCount={items.length}
        existing={items}
        onCreated={(ingredient) => {
          setItems((prev) =>
            [...prev.filter((row) => row.id !== ingredient.id), ingredient].sort(
              (a, b) => a.name.localeCompare(b.name, "sr")
            )
          );
        }}
      />
    </>
  );
}

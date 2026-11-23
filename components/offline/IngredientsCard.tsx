"use client";

import { useEffect, useMemo, useState } from "react";
import { Carrot } from "lucide-react";
import { CreateIngredientSheet } from "@/components/create/CreateIngredientSheet";
import { DeleteIngredientButton } from "@/components/create/DeleteIngredientButton";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { DashboardPreviewCard, dashboardRowClass } from "@/components/dashboard/DashboardLayout";
import { useOnline } from "@/lib/hooks/useOnline";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import {
  getCachedIngredients,
  type CachedIngredient,
} from "@/lib/offline/cache";
import { FREE_MAX_INGREDIENTS } from "@/lib/plan/limits";
import { TableMoney } from "@/components/ui/TableMoney";

export type IngredientsCardProps = {
  initialIngredients: CachedIngredient[];
  initialCount: number | null;
  venueId?: string | null;
};

export function IngredientsCard({
  initialIngredients,
  initialCount,
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
    if (online) return;
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
    if (isFree && (count ?? items.length) >= FREE_MAX_INGREDIENTS) {
      showFreeLimit("FREE_LIMIT_INGREDIENTS");
      return;
    }
    setOpen(true);
  }

  function handleDeleted(ingredientId: string) {
    setItems((prev) => prev.filter((row) => row.id !== ingredientId));
  }

  const count = online
    ? initialCount === null ? null : initialCount + items.length - initialIngredients.length
    : items.length;
  const shown = items.slice(0, 3);

  return (
    <>
      <DashboardPreviewCard
        title={sr.ingredients.title}
        count={count}
        href="/ingredients"
        onAdd={openCreate}
        addLabel={sr.create.ingredient.add}
        emptyTitle={sr.listStates.ingredients.empty}
        emptyIcon={<Carrot />}
        hasItems={shown.length > 0}
      >
        {shown.map((item) => (
          <li key={item.id} className={dashboardRowClass}>
            <Carrot className="size-4 shrink-0 text-text-2" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-text">{item.name}</p>
              <p className="truncate text-ui-xs text-text-2">
                <TableMoney value={item.price} unit={item.unit} />
              </p>
            </div>
            <DeleteIngredientButton compact ingredientId={item.id} ingredientName={item.name} onDeleted={handleDeleted} />
          </li>
        ))}
      </DashboardPreviewCard>

      <CreateIngredientSheet
        open={open}
        onClose={() => setOpen(false)}
        venueId={resolvedVenueId}
        currentCount={count ?? items.length}
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

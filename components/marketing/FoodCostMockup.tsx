import { Calculator, Check, UtensilsCrossed } from "lucide-react";
import { calculateFoodCost } from "@/lib/calc/foodcost";
import { formatMoney } from "@/lib/utils/format";

const EXAMPLE = calculateFoodCost({
  lines: [
    { quantity: 100, quantityUnit: "g", price: 840, priceUnit: "kg", lossPercent: 0 },
    { quantity: 4, quantityUnit: "g", price: 1750, priceUnit: "kg", lossPercent: 0 },
    { quantity: 1, quantityUnit: "kom", price: 30, priceUnit: "kom", lossPercent: 0 },
  ],
  mode: "target_food_cost", percent: 30, vatPercent: 20,
});

export function FoodCostMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-strong bg-surface text-left shadow-[0_24px_80px_-32px_rgba(0,0,0,0.7)]">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/40 px-5 py-4">
        <span className="inline-flex items-center gap-2 text-sm font-medium"><Calculator className="size-4 text-muted" />Food cost kalkulator</span>
        <span className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted">Primer podataka</span>
      </div>
      <div className="p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-surface-2 text-muted"><UtensilsCrossed className="size-5 stroke-[1.5]" /></span>
          <div><p className="text-lg font-semibold tracking-tight">Ćevapi u lepinji</p><p className="mt-0.5 text-sm text-muted">Recept za 5 porcija</p></div>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border pb-3 text-xs font-medium uppercase tracking-wider text-muted"><span>Sastojak</span><span>Količina</span><span>Trošak</span></div>
        {[{ name: "Juneće meso", qty: "500 g", cost: 420 }, { name: "Začini", qty: "20 g", cost: 35 }, { name: "Lepinja", qty: "5 kom", cost: 150 }].map((line) => (
          <div key={line.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border/70 py-4 text-sm"><span className="font-medium">{line.name}</span><span className="min-w-12 text-right text-muted">{line.qty}</span><span className="min-w-16 whitespace-nowrap text-right tabular-nums">{formatMoney(line.cost)} din</span></div>
        ))}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div><p className="text-xs text-muted">Trošak porcije</p><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(EXAMPLE.portionCost)} <span className="text-sm font-normal text-muted">din</span></p></div>
          <div className="border-l border-border pl-5"><p className="text-xs text-muted">Predložena cena bez PDV-a</p><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(EXAMPLE.netPrice, { fractionDigits: 2 })} <span className="text-sm font-normal text-muted">din</span></p></div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-3 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-success" />Ciljni food cost 30%</span><span>Sa PDV-om (20%): <strong className="font-medium text-text">{formatMoney(EXAMPLE.grossPrice)} din</strong></span></div>
      </div>
    </div>
  );
}

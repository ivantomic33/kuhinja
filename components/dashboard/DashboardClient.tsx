"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Carrot, ClipboardList, History, Plus } from "lucide-react";
import { CreateTemplateSheet } from "@/components/create/CreateTemplateSheet";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { IngredientsCard } from "@/components/offline/IngredientsCard";
import { OfflineCacheSeeder } from "@/components/offline/OfflineCacheSeeder";
import {
  RecentRecipesCard,
  type RecipeFoodCosts,
  type RecipePreview,
} from "@/components/offline/RecentRecipesCard";
import { ShiftTemplatesCard, type TemplateRow } from "@/components/offline/ShiftTemplatesCard";
import { Badge } from "@/components/ui/Badge";
import { BigNumber } from "@/components/ui/BigNumber";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import RouteError from "@/components/ui/RouteError";
import type { CachedIngredient } from "@/lib/offline/cache";
import { getEntitlements, planDisplayName, type PlanId } from "@/lib/plan/entitlements";
import { sr } from "@/lib/i18n/sr";
import { queryKeys } from "@/lib/query/keys";
import { useHydratedData } from "@/lib/query/use-hydrated-data";
import { DashboardLayout, dashboardKpiHeight } from "./DashboardLayout";

export type DashboardData = {
  firstName: string;
  greeting: string;
  plan: PlanId;
  recipes: RecipePreview[];
  recipeCount: number | null;
  ingredients: CachedIngredient[];
  ingredientCount: number | null;
  stockAlertCount: number;
  templates: TemplateRow[];
  initialTemplateCount: number | null;
  loadError: boolean;
};

export type DashboardClientProps = {
  venueId: string | null;
  recipeFoodCosts: Promise<RecipeFoodCosts>;
  trends: { recipes: ReactNode; ingredients: ReactNode; templates: ReactNode };
};

const copy = sr.dashboard;

export function DashboardClient({
  venueId, recipeFoodCosts, trends,
}: DashboardClientProps) {
  const {
    firstName, greeting, plan, recipes, recipeCount, ingredients, ingredientCount,
    stockAlertCount, templates, initialTemplateCount, loadError,
  } = useHydratedData<DashboardData>(queryKeys.dashboard(venueId));
  const { showFreeLimit } = usePlanUi();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateList, setTemplateList] = useState(templates);
  useEffect(() => setTemplateList(templates), [templates]);
  const entitlements = getEntitlements(plan);
  const templateCount = initialTemplateCount === null ? null : initialTemplateCount + templateList.length - templates.length;
  const metrics = [
    { label: copy.kpiRecipes, count: recipeCount, icon: BookOpen, trend: trends.recipes },
    { label: copy.kpiIngredients, count: ingredientCount, icon: Carrot, trend: trends.ingredients },
    { label: "Šabloni smene", count: templateCount, icon: ClipboardList, trend: trends.templates },
  ];

  function openTemplate() {
    if (plan === "free" && (templateCount ?? templateList.length) >= entitlements.maxShiftTemplates) {
      showFreeLimit("FREE_LIMIT_TEMPLATES");
      return;
    }
    setTemplateOpen(true);
  }

  return (
    <>
      <OfflineCacheSeeder recipes={recipes} ingredients={ingredients} templates={templateList} />
      <DashboardLayout
        heading={
          <PageHeader
            title={`${greeting}, ${firstName}`}
            description="Pregled vaše kuhinje"
            action={
              <>
                <Badge variant="neutral">{planDisplayName(plan)}</Badge>
                <PrimaryButton leftIcon={<Plus aria-hidden="true" />} onClick={openTemplate}>
                  Novi šablon smene
                </PrimaryButton>
              </>
            }
          />
        }
        kpis={
          <>
            {metrics.map(({ label, count, icon: Icon, trend }) => (
              <KpiCard
                key={label}
                className={dashboardKpiHeight}
                label={label}
                value={count === null ? "—" : <BigNumber label={label} value={count} />}
                icon={<Icon className="size-5" />}
                hint={trend}
              />
            ))}
            <KpiCard
              className={dashboardKpiHeight}
              label="Istorija cena"
              value={<span className="text-4xl font-semibold text-text-2">—</span>}
              icon={<History className="size-5" />}
              locked={!entitlements.priceHistory}
              lockedTitle="Dostupno od Pro plana."
              lockedHref="/premium#plan-pro"
              lockedLinkLabel="Otključaj istoriju cena"
              hint="Podaci još nisu povezani."
            />
          </>
        }
        notice={loadError ? <RouteError message={sr.listStates.dashboard.error} /> : null}
        footer={stockAlertCount > 0 ? (
          <Link href="/trebovanje" className="text-ui-sm font-semibold text-accent hover:underline">
            {plan === "free" ? "Nestalo sa stanja" : "Zalihe koje zahtevaju pažnju"} · {stockAlertCount}
          </Link>
        ) : null}
      >
        <RecentRecipesCard initialRecipes={recipes} initialCount={recipeCount} recipeFoodCosts={recipeFoodCosts} venueId={venueId} />
        <IngredientsCard initialIngredients={ingredients} initialCount={ingredientCount} venueId={venueId} />
        <ShiftTemplatesCard initialTemplates={templateList} count={templateCount} onRequestCreate={openTemplate} />
      </DashboardLayout>

      <CreateTemplateSheet
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        venueId={venueId}
        currentCount={templateCount ?? templateList.length}
        onCreated={(template) => {
          setTemplateList((previous) => [
            template,
            ...previous.filter((row) => row.id !== template.id),
          ]);
        }}
      />
    </>
  );
}

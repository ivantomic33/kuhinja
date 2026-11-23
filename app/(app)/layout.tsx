import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/require-user";
import type { PlanQueryResult } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import { FREE_MAX_RECIPES } from "@/lib/plan/limits";
import { AppQueryProvider } from "@/lib/query/provider";
import { isPremium } from "@/lib/supabase/plan";
import { getPlanDetails } from "@/lib/supabase/plan-server";
import { getRecipeCount } from "@/lib/supabase/recipe-count";

export const metadata: Metadata = { robots: { index: false, follow: false } };

function RecipeUsage({ count }: { count?: number }) {
  const percentage = Math.min(100, ((count ?? 0) / FREE_MAX_RECIPES) * 100);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-text">Free plan</p>
        <p className="text-ui-xs text-text-2 tabular-nums">
          Recepti {count ?? "—"} / {FREE_MAX_RECIPES}
        </p>
      </div>
      <div className="progress mt-2">
        <span style={{ width: `${percentage}%` }} />
      </div>
    </>
  );
}

async function LoadedRecipeUsage() {
  return <RecipeUsage count={await getRecipeCount()} />;
}

/** Protected app shell — session required (middleware + this layout). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  const displayName =
    (user.user_metadata?.full_name as string | undefined) || null;

  const planDetails = await getPlanDetails();
  const premium = isPremium(planDetails.plan);

  const initialPlan: PlanQueryResult = {
    ...planDetails,
    accountName: displayName ?? user.email ?? null,
    email: user.email ?? null,
  };

  return (
    <AppQueryProvider>
      <AppShell
        email={user.email}
        displayName={displayName ?? user.email ?? sr.app.name}
        isPremium={premium}
        initialPlan={initialPlan}
        recipeUsage={premium ? null : (
          <Suspense fallback={<RecipeUsage />}>
            <LoadedRecipeUsage />
          </Suspense>
        )}
      >
        {children}
      </AppShell>
    </AppQueryProvider>
  );
}

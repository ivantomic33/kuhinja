import { PageSkeleton } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";

export default function RecipesLoading() {
  return <PageSkeleton title={sr.recipes.title} />;
}

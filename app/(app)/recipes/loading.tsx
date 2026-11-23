import { WorkspaceSkeleton } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";

export default function RecipesLoading() {
  return <WorkspaceSkeleton title={sr.recipes.title} description={sr.listStates.recipes.description} />;
}

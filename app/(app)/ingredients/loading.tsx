import { WorkspaceSkeleton } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";

export default function IngredientsLoading() {
  return <WorkspaceSkeleton title={sr.ingredients.title} description={sr.ingredients.subtitle} viewToggle />;
}

import { PageSkeleton } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";

export default function IngredientsLoading() {
  return <PageSkeleton title={sr.ingredients.title} />;
}

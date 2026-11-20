import { PageSkeleton } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";

export default function Loading() {
  return <PageSkeleton title={sr.shift.title} />;
}

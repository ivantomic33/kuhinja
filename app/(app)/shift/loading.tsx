import { PickerSkeleton } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";

export default function Loading() {
  return <PickerSkeleton title={sr.shift.title} description={sr.listStates.shift.description} />;
}

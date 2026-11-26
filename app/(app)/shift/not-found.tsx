import { EmptyState } from "@/components/ui/EmptyState";
import { StateLink } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";

export default function NotFound() {
  return <EmptyState titleAs="h1" title={sr.shift.notFound} action={<StateLink href="/shift">Izaberi šablon</StateLink>} />;
}

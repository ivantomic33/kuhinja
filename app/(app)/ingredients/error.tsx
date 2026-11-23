"use client";

import RouteError from "@/components/ui/RouteError";
import { sr } from "@/lib/i18n/sr";

export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title={sr.ingredients.title} description={sr.ingredients.subtitle} message={sr.listStates.ingredients.error} reset={reset} />;
}

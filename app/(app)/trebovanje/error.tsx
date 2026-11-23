"use client";

import RouteError from "@/components/ui/RouteError";
import { sr } from "@/lib/i18n/sr";
import { stockSr } from "@/lib/i18n/stock";

export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title={stockSr.title} description={stockSr.subtitle} message={sr.listStates.stock.error} reset={reset} />;
}

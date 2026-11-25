"use client";

import RouteError from "@/components/ui/RouteError";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <RouteError
      title="Otpad"
      description="Evidencija bačenih količina"
      message="Stranica nije učitana."
      reset={reset}
    />
  );
}

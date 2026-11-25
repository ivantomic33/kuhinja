"use client";

import RouteError from "@/components/ui/RouteError";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <RouteError
      title="Narudžbenice"
      description="Nabavka i prijem robe"
      message="Stranica nije učitana."
      reset={reset}
    />
  );
}

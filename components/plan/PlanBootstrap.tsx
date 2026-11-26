"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import type { PlanQueryResult } from "@/lib/hooks/usePlan";
import { queryKeys } from "@/lib/query/keys";

type PlanBootstrapProps = {
  initial: PlanQueryResult;
};

/**
 * Seeds React Query with the server-resolved plan so client hooks do not
 * refetch profiles on every app shell mount.
 */
export function PlanBootstrap({ initial }: PlanBootstrapProps) {
  const queryClient = useQueryClient();
  const seeded = useRef(false);

  if (!seeded.current) {
    seeded.current = true;
    queryClient.setQueryData(queryKeys.plan, initial);
  }

  return null;
}

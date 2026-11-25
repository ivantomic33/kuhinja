"use client";

import { skipToken, useQuery, type QueryKey } from "@tanstack/react-query";

/** App Router refresh supplies updates through the boundary. */
export function useHydratedData<T>(queryKey: QueryKey): T {
  const { data } = useQuery<T>({ queryKey, queryFn: skipToken });
  if (data === undefined) throw new Error("Missing server data for " + JSON.stringify(queryKey));
  return data;
}

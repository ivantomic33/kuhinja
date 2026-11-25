import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
  type DehydratedState,
  type QueryKey,
} from "@tanstack/react-query";
import type { ReactNode } from "react";

/** Seed a short-lived QueryClient with the data this Server Component loaded. */
export function dehydrateQuery<T>(queryKey: QueryKey, data: T): DehydratedState {
  const client = new QueryClient();
  client.setQueryData(queryKey, data);
  return dehydrate(client);
}

export function Hydrate({
  state,
  children,
}: {
  state: DehydratedState;
  children: ReactNode;
}) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}

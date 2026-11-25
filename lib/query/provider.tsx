"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

type AppQueryProviderProps = {
  children: ReactNode;
};

/**
 * One QueryClient per browser session (useState factory).
 * Never create the client at module scope — that would share state across
 * concurrent SSR requests.
 *
 * List defaults: 60s stale, no focus refetch, 10 min GC.
 * Realtime-sensitive queries override staleTime per-call.
 */
export function AppQueryProvider({ children }: AppQueryProviderProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

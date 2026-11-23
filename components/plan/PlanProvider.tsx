"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getFreeLimitCode,
  type FreeLimitCode,
} from "@/lib/plan/free-limit";

const FreeLimitSheet = dynamic(() =>
  import("@/components/plan/FreeLimitSheet").then((module) => module.FreeLimitSheet)
);

type PlanUiContextValue = {
  /** Open the free-limit bottom sheet for a known code */
  showFreeLimit: (code?: FreeLimitCode | null) => void;
  /** Inspect an error; open sheet when it is a free-limit error */
  handleError: (error: unknown) => boolean;
  closeFreeLimit: () => void;
};

const PlanUiContext = createContext<PlanUiContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<FreeLimitCode | null>();

  const showFreeLimit = useCallback((next?: FreeLimitCode | null) => {
    setCode(next ?? null);
    setOpen(true);
  }, []);

  const closeFreeLimit = useCallback(() => {
    setOpen(false);
  }, []);

  const handleError = useCallback(
    (error: unknown) => {
      const detected = getFreeLimitCode(error);
      if (!detected) return false;
      showFreeLimit(detected);
      return true;
    },
    [showFreeLimit]
  );

  const value = useMemo(
    () => ({ showFreeLimit, handleError, closeFreeLimit }),
    [showFreeLimit, handleError, closeFreeLimit]
  );

  return (
    <PlanUiContext.Provider value={value}>
      {children}
      {code !== undefined ? (
        <FreeLimitSheet open={open} onClose={closeFreeLimit} code={code} />
      ) : null}
    </PlanUiContext.Provider>
  );
}

export function usePlanUi(): PlanUiContextValue {
  const ctx = useContext(PlanUiContext);
  if (!ctx) {
    throw new Error("usePlanUi must be used within PlanProvider");
  }
  return ctx;
}

/** Safe variant when provider might be absent (returns no-ops). */
export function usePlanUiOptional(): PlanUiContextValue {
  const ctx = useContext(PlanUiContext);
  return (
    ctx ?? {
      showFreeLimit: () => undefined,
      handleError: () => false,
      closeFreeLimit: () => undefined,
    }
  );
}

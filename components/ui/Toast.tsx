"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Check } from "lucide-react";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastItem = {
  id: string;
  message: string;
  tone?: "default" | "success" | "warning" | "danger";
  action?: ToastAction;
  durationMs?: number;
};

type ToastOptions = {
  tone?: ToastItem["tone"];
  action?: ToastAction;
  durationMs?: number;
};

type ToastContextValue = {
  toast: (message: string, toneOrOptions?: ToastItem["tone"] | ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: () => undefined,
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach(timer => window.clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, toneOrOptions?: ToastItem["tone"] | ToastOptions) => {
      const options: ToastOptions =
        typeof toneOrOptions === "string" || toneOrOptions == null
          ? { tone: toneOrOptions ?? "success" }
          : toneOrOptions;

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now());

      const item: ToastItem = {
        id,
        message,
        tone: options.tone ?? "success",
        action: options.action,
        durationMs: options.durationMs ?? (options.action ? 10000 : 2200),
      };

      setItems((prev) => [...prev.slice(-2), item]);
      const timer = window.setTimeout(() => dismiss(id), item.durationMs);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);
  const current = items[items.length - 1];

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="sr-only">
        <div role="status" aria-atomic="true">
          {current && current.tone !== "danger" ? <span key={current.id}>{current.message}</span> : null}
        </div>
        <div role="alert" aria-atomic="true">
          {current?.tone === "danger" ? <span key={current.id}>{current.message}</span> : null}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {current ? <ToastView key="toast" item={current} dismiss={dismiss} /> : null}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

function ToastView({ item, dismiss }: { item: ToastItem; dismiss: (id: string) => void }) {
  const reduced = usePrefersReducedMotion();
  const present = useIsPresent();
  return (
    <motion.div
      className="app-toast"
      data-motion-surface
      inert={!present || undefined}
      aria-hidden={!present || undefined}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, y: 6 }}
      transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
    >
      {item.tone === "warning" ? (
        <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
      ) : item.tone !== "danger" ? (
        <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
      ) : null}
      <p className="min-w-0 flex-1" aria-hidden="true">{item.message}</p>
      {item.action ? (
        <button
          type="button"
          className="focus-ring shrink-0 rounded-lg px-2 py-1 text-ui-sm font-semibold text-accent hover:bg-[var(--accent-soft)]"
          onClick={() => {
            item.action?.onClick();
            dismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      ) : null}
    </motion.div>
  );
}

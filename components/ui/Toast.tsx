"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

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
      <div
        className={cn(
          "mise-toast",
          current
            ? "pointer-events-auto opacity-100 translate-y-0"
            : "pointer-events-none opacity-0 translate-y-5"
        )}
        role="status"
        aria-live="polite"
      >
        {current ? (
          <>
            {current.tone === "warning" ? (
              <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
            ) : current.tone !== "danger" ? (
              <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
            ) : null}
            <span className="min-w-0 flex-1">{current.message}</span>
            {current.action ? (
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-1 text-[length:var(--fs-sm)] font-semibold text-accent hover:bg-[var(--accent-soft)]"
                onClick={() => {
                  current.action?.onClick();
                  dismiss(current.id);
                }}
              >
                {current.action.label}
              </button>
            ) : null}
          </>
        ) : (
          <span className="opacity-0">.</span>
        )}
      </div>
    </ToastContext.Provider>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Circle, X } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoCard";
import { cn } from "@/lib/utils/cn";
import { sr } from "@/lib/i18n/sr";

export type FirstRunChecklistStep = {
  id: string;
  title: string;
  hint: string;
  href: string;
  done: boolean;
};

export type FirstRunChecklistProps = {
  steps: FirstRunChecklistStep[];
};

const DISMISS_KEY = "treuplate:onboarding-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore blocked storage */
  }
}

export function FirstRunChecklist({ steps }: FirstRunChecklistProps) {
  const copy = sr.onboarding.checklist;
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
    setReady(true);
  }, []);

  const doneCount = useMemo(
    () => steps.reduce((count, step) => count + (step.done ? 1 : 0), 0),
    [steps],
  );
  const total = steps.length;
  const allDone = total > 0 && doneCount === total;
  const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  if (!ready || dismissed || allDone || total === 0) return null;

  function dismiss() {
    writeDismissed();
    setDismissed(true);
  }

  return (
    <BentoCard
      dense
      header={
        <div className="flex w-full items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text">{copy.title}</h2>
            <p className="mt-1 text-sm text-text-2">
              {copy.progress(doneCount, total)}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={copy.dismissAria}
            className={cn(
              "focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
              "text-muted hover:bg-surface-2 hover:text-text",
            )}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={copy.progress(doneCount, total)}
          className="progress"
        >
          <span style={{ width: `${progress}%` }} />
        </div>

        <ol className="grid gap-2">
          {steps.map((step) => {
            const status = step.done ? copy.doneSr : copy.todoSr;
            const Icon = step.done ? Check : Circle;
            return (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className={cn(
                    "focus-ring flex min-h-11 items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-3",
                    "hover:bg-surface-3",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full",
                      step.done
                        ? "bg-success/15 text-success"
                        : "bg-surface text-text-3",
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-text">{step.title}</span>
                      <span className="sr-only">{status}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-text-2">{step.hint}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </BentoCard>
  );
}

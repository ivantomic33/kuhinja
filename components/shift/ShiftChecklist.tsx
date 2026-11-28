"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardList,
  CloudOff,
  Lock,
  Wifi,
} from "lucide-react";
import { usePlanUiOptional } from "@/components/plan/PlanProvider";
import { BentoCard } from "@/components/ui/BentoCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { StateLink } from "@/components/ui/RouteStates";
import { ChecklistItemRow } from "@/components/shift/ChecklistItemRow";
import { ProgressRing } from "@/components/shift/ProgressRing";
import { TimerCard, type ActiveTimer } from "@/components/shift/TimerCard";
import {
  completeChecklistRun,
  createChecklistRun,
  flushChecklistSyncQueue,
  persistChecklistItemDelta,
  hasPendingChecklistWrites,
  loadChecklistRun,
  type RunSnapshot,
} from "@/lib/offline/checklist-sync";
import { sr } from "@/lib/i18n/sr";
import type { ChecklistItemInput } from "@/lib/schemas/domain";
import { signalTimerEnd } from "@/lib/shift/alerts";
import { SHIFT_QUERY_KEYS } from "@/lib/shift/constants";
import { cn } from "@/lib/utils/cn";

export type ShiftChecklistProps = {
  templateId: string;
  templateName: string;
  venueId: string;
  userId: string;
  timerLimit: number | null;
  items: ChecklistItemInput[];
  initialRun: RunSnapshot | null;
};

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (
    type: "release",
    listener: () => void
  ) => void;
};

function groupItems(items: ChecklistItemInput[]) {
  const map = new Map<string, ChecklistItemInput[]>();
  for (const item of items) {
    const key = item.group?.trim() || sr.shift.groupOther;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return Array.from(map.entries());
}

export function ShiftChecklist({
  templateId,
  templateName,
  venueId,
  userId,
  timerLimit,
  items,
  initialRun,
}: ShiftChecklistProps) {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [queued, setQueued] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const firedTimersRef = useRef<Set<string>>(new Set());
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const { showFreeLimit } = usePlanUiOptional();

  const maxTimers = timerLimit ?? Number.POSITIVE_INFINITY;

  const runQuery = useQuery({
    queryKey: SHIFT_QUERY_KEYS.run(templateId),
    queryFn: async (): Promise<RunSnapshot | null> => initialRun,
    initialData: initialRun,
    staleTime: Infinity,
  });

  const run = runQuery.data ?? null;
  const runKey = SHIFT_QUERY_KEYS.run(templateId);
  const [writeError, setWriteError] = useState(false);

  const { mutate: saveProgress, isPending: savingProgress } = useMutation({
    scope: { id: `checklist:${userId}:${templateId}` },
    mutationFn: async (operation: { itemId: string } | "start" | "complete") => {
      let current = queryClient.getQueryData<RunSnapshot | null>(runKey);
      if (!current || (operation === "start" && current.status === "completed")) {
        const result = await createChecklistRun({
          venue_id: venueId, template_id: templateId, user_id: userId,
        });
        queryClient.setQueryData(runKey, result.run);
        setQueued(result.queued);
        current = result.run;
      }

      if (operation === "start" || current.status === "completed") return;
      const result = operation === "complete"
        ? await completeChecklistRun(current)
        : await persistChecklistItemDelta({
            run: current,
            itemId: operation.itemId,
            checked: !current.checked_item_ids.includes(operation.itemId),
          });
      queryClient.setQueryData(runKey, result.run);
      setQueued(result.queued);
    },
    onMutate: () => setWriteError(false),
    onError: () => setWriteError(true),
  });

  useEffect(() => {
    if (!initialRun) saveProgress("start");
    else {
      const key = SHIFT_QUERY_KEYS.run(templateId);
      queryClient.setQueryData<RunSnapshot | null>(key, (current) =>
        current?.id === initialRun.id ? current : initialRun
      );
    }
  }, [initialRun, queryClient, saveProgress, templateId]);

  useEffect(() => {
    const onOnline = async () => {
      setOnline(true);
      setSyncing(true);
      try {
        await flushChecklistSyncQueue();
        const key = SHIFT_QUERY_KEYS.run(templateId);
        const current = queryClient.getQueryData<RunSnapshot | null>(key);
        if (current) {
          const synced = await loadChecklistRun(current.id);
          if (synced && queryClient.getQueryData(key) === current) {
            const remaining = await hasPendingChecklistWrites(current.id);
            if (!remaining && queryClient.getQueryData(key) === current) {
              queryClient.setQueryData(key, synced);
              setQueued(false);
            }
          }
        }
      } catch {
        setWriteError(true);
      } finally {
        setSyncing(false);
      }
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (navigator.onLine) void onOnline();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [queryClient, templateId]);


  // Live clock for timers
  useEffect(() => {
    if (timers.length === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timers.length]);

  // Timer end side-effects
  useEffect(() => {
    for (const timer of timers) {
      if (timer.endsAt > now) continue;
      if (firedTimersRef.current.has(timer.itemId)) continue;
      firedTimersRef.current.add(timer.itemId);
      void signalTimerEnd(sr.shift.timerDone, `${timer.label} — ${sr.shift.timerDoneBody}`);
    }
  }, [timers, now]);

  // Screen Wake Lock while shift is active
  useEffect(() => {
    const active = run?.status === "active";
    let cancelled = false;

    async function requestLock() {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: {
            request: (type: "screen") => Promise<WakeLockSentinelLike>;
          };
        };
        if (!active || !nav.wakeLock) return;
        const sentinel = await nav.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null;
          }
        });
      } catch {
        // Wake Lock may be denied.
      }
    }

    async function releaseLock() {
      try {
        if (wakeLockRef.current && !wakeLockRef.current.released) {
          await wakeLockRef.current.release();
        }
      } catch {
        // ignore
      } finally {
        wakeLockRef.current = null;
      }
    }

    if (active) {
      void requestLock();
    } else {
      void releaseLock();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible" && active) {
        void requestLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void releaseLock();
    };
  }, [run?.status]);

  const checkedSet = useMemo(() => {
    return new Set(run?.checked_item_ids ?? []);
  }, [run?.checked_item_ids]);

  const doneCount = useMemo(() => {
    return items.reduce(
      (acc, item) => (checkedSet.has(item.id) ? acc + 1 : acc),
      0
    );
  }, [items, checkedSet]);

  const allDone = items.length > 0 && doneCount === items.length;
  const completed = run?.status === "completed";
  const activeTimerIds = useMemo(
    () => new Set(timers.map((t) => t.itemId)),
    [timers]
  );
  const timersAtLimit = timers.length >= maxTimers;

  const groups = useMemo(() => groupItems(items), [items]);

  const toggleItem = (itemId: string) => {
    if (!completed) saveProgress({ itemId });
  };

  const startTimer = useCallback(
    (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item || !item.minutes) return;
      if (activeTimerIds.has(itemId)) return;
      if (timers.length >= maxTimers) {
        showFreeLimit("FREE_LIMIT_TIMERS");
        return;
      }

      const totalMs = item.minutes * 60_000;
      setTimers((prev) => [
        ...prev,
        {
          itemId,
          label: item.label,
          endsAt: Date.now() + totalMs,
          totalMs,
        },
      ]);
      firedTimersRef.current.delete(itemId);
    },
    [
      items,
      activeTimerIds,
      timers.length,
      maxTimers,
      showFreeLimit,
    ]
  );

  const stopTimer = useCallback((itemId: string) => {
    setTimers((prev) => prev.filter((t) => t.itemId !== itemId));
    firedTimersRef.current.delete(itemId);
  }, []);

  function completeShift() {
    saveProgress("complete");
    setTimers([]);
  }

  const statusLabel = completed
    ? sr.shift.shiftCompleted
    : online
      ? syncing
        ? sr.shift.syncing
        : queued
          ? sr.shift.offlineHint
          : savingProgress
            ? sr.shift.saveProgress
            : sr.shift.shiftActive
      : sr.shift.offline;

  return (
    <div className="relative flex min-h-[calc(100dvh-10rem)] flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted">{sr.shift.subtitle}</p>
        <h1>
          {templateName}
        </h1>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {online ? (
            <Wifi className="size-3.5" aria-hidden="true" />
          ) : (
            <CloudOff className="size-3.5" aria-hidden="true" />
          )}
          <span>{statusLabel}</span>
          {run?.status === "active" ? (
            <span className="text-muted">· {sr.shift.wakeLockOn}</span>
          ) : null}
        </div>
      </header>

      <BentoCard className="items-center">
        <ProgressRing done={doneCount} total={items.length} />
        {allDone && !completed ? (
          <p className="text-center text-sm font-medium text-success">
            {sr.shift.allDone}
          </p>
        ) : null}
        {completed ? (
          <div className="flex items-center justify-center gap-1 text-success">
            <CheckCircle2 className="size-5" aria-hidden="true" />
            <span className="text-sm font-medium">{sr.shift.shiftCompleted}</span>
          </div>
        ) : null}
      </BentoCard>

      {timers.length > 0 ? (
        <BentoCard
          header={
            <h2 className="text-base font-semibold">{sr.shift.activeTimers}</h2>
          }
        >
          <div className="flex flex-col gap-2">
            {timers.map((timer) => (
              <TimerCard
                key={timer.itemId}
                timer={timer}
                now={now}
                onStop={stopTimer}
              />
            ))}
          </div>
        </BentoCard>
      ) : null}

      {timersAtLimit ? (
        <div
          className="flex items-start gap-2 rounded-[var(--radius-card)] border border-border bg-surface-2 p-2"
          role="status"
        >
          <Lock className="mt-1 size-5 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-text">
              {sr.shift.lockedTimers}
            </p>
            <p className="text-sm text-muted">{sr.shift.lockedTimersHint}</p>
            <PrimaryButton
              type="button"
              variant="ghost"
              className="mt-1"
              onClick={() => showFreeLimit("FREE_LIMIT_TIMERS")}
            >
              {sr.premium.ctaShort}
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <BentoCard>
          <EmptyState
            icon={<ClipboardList className="size-7" aria-hidden="true" />}
            title={sr.shift.emptyItemsHint}
            action={<StateLink href="/shift">Izaberi drugi šablon</StateLink>}
          />
        </BentoCard>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([groupName, groupItems]) => (
            <section key={groupName} className="flex flex-col gap-1">
              <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted">
                {groupName}
              </h2>
              <div className="flex flex-col gap-1">
                {groupItems.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    checked={checkedSet.has(item.id)}
                    timerActive={activeTimerIds.has(item.id)}
                    timerLocked={timersAtLimit}
                    onToggle={toggleItem}
                    onStartTimer={startTimer}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {items.length > 0 ? <div
        className={cn(
          "sticky bottom-[var(--mobile-nav-offset,0px)] z-30 mt-auto border-t border-border bg-surface/95 p-3 backdrop-blur-sm"
        )}
      >
        <div className="mx-auto max-w-3xl">
          <PrimaryButton
            fullWidth
            disabled={completed || items.length === 0 || savingProgress}
            onClick={completeShift}
            leftIcon={
              completed ? (
                <CheckCircle2 className="size-5" aria-hidden="true" />
              ) : undefined
            }
          >
            {completed ? sr.shift.shiftCompleted : sr.shift.completeShift}
          </PrimaryButton>
          {writeError ? <p role="alert" className="text-sm text-danger">{sr.common.error}</p> : null}
        </div>
      </div> : null}
    </div>
  );
}

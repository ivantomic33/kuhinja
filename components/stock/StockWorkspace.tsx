"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Apple,
  Beef,
  Bell,
  Boxes,
  Carrot,
  ChartNoAxesCombined,
  Copy,
  History,
  LayoutGrid,
  Minus,
  Package,
  PackagePlus,
  Plus,
  Scale,
  Search,
  Sandwich,
  Table2,
  Trash2,
  Utensils,
  Vegan,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { Badge } from "@/components/ui/Badge";
import { BentoCard } from "@/components/ui/BentoCard";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import RouteError from "@/components/ui/RouteError";
import { StateLink } from "@/components/ui/RouteStates";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { UsageStrip } from "@/components/ui/UsageStrip";
import { StockMinimum } from "@/components/stock/StockMinimum";
import { usePlan } from "@/lib/hooks/usePlan";
import { stockAlertsSr as alertsText } from "@/lib/i18n/stock-alerts";
import { stockSr as t } from "@/lib/i18n/stock";
import {
  canAddStockItem,
  hasMinPlan,
  isUnlimited,
  planDisplayName,
} from "@/lib/plan/entitlements";
import { classifyStockAlert, type StockAlertStatus } from "@/lib/stock/alerts";
import { removeStockLevel } from "@/lib/stock/actions";
import {
  buildBuyList,
  effectiveUsedToday,
  formatBuyListClipboard,
  formatQty,
  stockLevelPercent,
  stockValue,
  usedTodayValue,
} from "@/lib/stock/math";
import type { RecipeForSale, StockRow } from "@/lib/stock/types";
import { createClient } from "@/lib/supabase/client";
import { fetchStockRows, keepStockSnapshot } from "@/lib/stock/read";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import "./stock-alerts.css";

const HistorySheet = dynamic(() => import("./HistorySheet").then((module) => module.HistorySheet));
const InventoryModal = dynamic(() => import("./InventoryModal").then((module) => module.InventoryModal));
const RestockModal = dynamic(() => import("./RestockModal").then((module) => module.RestockModal));
const SaleModal = dynamic(() => import("./SaleModal").then((module) => module.SaleModal));
const WriteOffModal = dynamic(() => import("./WriteOffModal").then((module) => module.WriteOffModal));
const stockPageSize = 25;

type ViewMode = "table" | "cards";
type ModalKind =
  | null
  | "sale"
  | "restock"
  | "writeoff"
  | "inventory"
  | "history";

export type StockWorkspaceProps = {
  venueId: string | null;
  initialRows: StockRow[];
  recipes: RecipeForSale[];
  loadError?: boolean;
  userId?: string | null;
};

function stockBarTone(
  status: StockAlertStatus,
  hasMin: boolean
): "success" | "warning" | "danger" | "empty" | "accent" {
  if (status === "bez") return "empty";
  if (status === "crit") return "danger";
  if (status === "warn") return "warning";
  if (status === "ok" && hasMin) return "success";
  return "accent";
}

function StockLevel({
  row,
  status,
  compact = false,
}: {
  row: StockRow;
  status: StockAlertStatus;
  compact?: boolean;
}) {
  const hasMin = row.min > 0;
  const label = row.hasLevel
    ? `${row.name}: ${formatQty(row.qty)} ${row.unit}${hasMin ? "" : ` · ${t.levelWithoutMin}`}`
    : `${row.name}: ${t.statusNone}`;
  const tone = stockBarTone(status, hasMin);
  return (
    <div className={compact ? "max-w-[120px]" : undefined} title={label}>
      <ProgressBar
        value={
          row.hasLevel
            ? stockLevelPercent(row.qty, row.min, effectiveUsedToday(row))
            : 0
        }
        tone={tone}
        trackClassName={cn(
          "stock-bar",
          !hasMin && row.hasLevel && "stock-bar-presence"
        )}
        ariaLabel={label}
      />
    </div>
  );
}

const alertRank = { crit: 0, warn: 1, bez: 2, ok: 3 };

function shiftEta(shifts: number, prefix = "još ") {
  return shifts < 1
    ? alertsText.shortEta
    : `${prefix}${alertsText.shiftCount(Math.round(shifts))}`;
}

export function StockWorkspace({
  venueId,
  initialRows,
  recipes,
  loadError = false,
  userId = null,
}: StockWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { entitlements, isLoading: isPlanLoading, plan } = usePlan();
  const { showFreeLimit } = usePlanUi();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [view, setView] = useState<ViewMode>("table");
  const [focusMinRequested, setFocusMinRequested] = useState(false);
  const [onlyRunout, setOnlyRunout] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [saleMounted, setSaleMounted] = useState(false);
  const refreshLiveStock = useRef<() => void>(() => {});
  const stockVersion = useRef(0);
  const [removeTarget, setRemoveTarget] = useState<StockRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string>();
  const [historyIngredientId, setHistoryIngredientId] = useState<string | null>(
    null
  );
  const [restockPrefer, setRestockPrefer] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    if (!venueId) return;
    const activeVenueId = venueId;

    const supabase = createClient();
    let timeout: number | undefined;
    let active = true;
    let inFlight = false;
    let pending = false;

    async function settleStock() {
      timeout = undefined;
      inFlight = true;
      const version = stockVersion.current;
      try {
        const nextRows = await fetchStockRows(activeVenueId);
        if (active && stockVersion.current === version) {
          setRows((current) => keepStockSnapshot(current, nextRows));
        }
      } catch {
        // Keep the last successful snapshot until the next refresh.
      } finally {
        inFlight = false;
        if (pending) {
          pending = false;
          refreshStock();
        }
      }
    }

    function refreshStock() {
      if (!active || timeout !== undefined || document.hidden || !navigator.onLine) return;
      if (inFlight) {
        pending = true;
        return;
      }
      timeout = window.setTimeout(() => void settleStock(), 150);
    }

    // A fresh topic avoids reusing a channel that is still unsubscribing.
    const topic = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`stock-levels:${venueId}:${topic}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stock_levels", filter: `venue_id=eq.${venueId}` }, refreshStock)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stock_levels", filter: `venue_id=eq.${venueId}` }, refreshStock)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refreshStock();
      });

    // Recover missed events and deletes without a realtime delete feed across locations.
    const interval = window.setInterval(refreshStock, 15000);
    refreshLiveStock.current = refreshStock;
    document.addEventListener("visibilitychange", refreshStock);
    window.addEventListener("online", refreshStock);

    return () => {
      active = false;
      refreshLiveStock.current = () => {};
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshStock);
      window.removeEventListener("online", refreshStock);
      void supabase.removeChannel(channel);
    };
  }, [venueId]);

  useEffect(() => {
    if (!focusMinRequested) return;
    const section = document.getElementById("stock-levels");
    const target = section?.querySelector<HTMLElement>(".col-min .btn-set-min")
      ?? section?.querySelector<HTMLElement>("th.col-min")
      ?? section;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    setFocusMinRequested(false);
  }, [focusMinRequested]);

  const canWarn = hasMinPlan(plan, "starter");
  const canPush = hasMinPlan(plan, "pro");
  const filterRunout = canWarn && onlyRunout;
  const stock = useMemo(() => {
    return rows
      .filter((row) => row.hasLevel)
      .map((row) => ({ row, ...classifyStockAlert(row, plan) }))
      .sort((a, b) =>
        alertRank[a.status] - alertRank[b.status] ||
        a.row.name.localeCompare(b.row.name, "sr")
      );
  }, [rows, plan]);
  const runoutSoon = stock.filter((item) => item.soon).sort(
    (a, b) => a.remainingShifts - b.remainingShifts
  );
  const gone = stock.filter((item) => item.gone);
  const leadAlert = runoutSoon[0] ?? gone[0];
  const soonNames = runoutSoon.map(
    ({ row, remainingShifts }) => `${row.name} (${shiftEta(remainingShifts)})`
  );
  const goneNames = gone.map(({ row }) => row.name);
  const notifications = [...soonNames, ...goneNames.map((name) => `${name} (${alertsText.goneEta})`)];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stock.filter(
      ({ row, soon }) =>
        (!filterRunout || soon) &&
        (row.name.toLowerCase().includes(q) || row.unit.toLowerCase().includes(q))
    );
  }, [stock, query, filterRunout]);
  const pageCount = filtered.length > 50 ? Math.ceil(filtered.length / stockPageSize) : 1;
  const currentPage = Math.min(page, pageCount - 1);
  const start = pageCount === 1 ? 0 : currentPage * stockPageSize;
  const visibleStock = pageCount === 1 ? filtered : filtered.slice(start, start + stockPageSize);
  const critical = stock.filter((item) => item.status === "crit").length;
  const warnings = stock.filter((item) => item.status === "warn").length;
  const belowMin = canWarn ? rows.filter((row) => row.hasLevel && row.qty > 0 && row.qty < row.min).length : 0;
  const stockItemCount = stock.length;
  const noLevel = rows.length - stockItemCount;
  const statusById = new Map(stock.map(({ row, status }) => [row.ingredientId, status]));
  const buyList = useMemo(() => buildBuyList(rows), [rows]);
  const value = useMemo(() => stockValue(rows), [rows]);
  const usedValue = useMemo(() => usedTodayValue(rows), [rows]);
  const maxStockItems = entitlements.maxStockItems;
  const stockUnlimited = isUnlimited(maxStockItems);
  const showUsage = !loadError;
  const overStockLimit = !stockUnlimited && stockItemCount > maxStockItems;

  function refresh() {
    router.refresh();
  }

  function changeStockPage(next: number) {
    setPage(next);
    document.querySelector("#stock-levels .stock-table-scroll")?.scrollTo({ top: 0 });
    document.getElementById("stock-levels")?.scrollIntoView({ block: "start" });
  }

  function showRunoutRows() {
    setQuery("");
    setPage(0);
    setOnlyRunout(true);
    setView("table");
    const table = document.getElementById("stock-levels");
    table?.focus({ preventScroll: true });
    table?.scrollIntoView({ block: "start" });
  }

  function focusSetMins() {
    setQuery("");
    const firstUnset = stock.findIndex(({ row }) => row.min <= 0);
    setPage(Math.max(0, Math.floor(firstUnset / stockPageSize)));
    setOnlyRunout(false);
    setView("table");
    setFocusMinRequested(true);
    toast(t.minFocusHint);
  }

  function openStockLimit() {
    showFreeLimit("FREE_LIMIT_STOCK_ITEMS");
    toast(
      t.limitReached.replace(
        "{n}",
        String(stockUnlimited ? stockItemCount : maxStockItems)
      ),
      "danger"
    );
  }

  function openRestock(ingredientId?: string) {
    const target = ingredientId
      ? rows.find((row) => row.ingredientId === ingredientId)
      : null;
    const createsNew = target ? !target.hasLevel : false;
    if (createsNew && !canAddStockItem(plan, stockItemCount)) {
      openStockLimit();
      return;
    }
    setRestockPrefer(ingredientId ?? null);
    setModal("restock");
  }

  function openWriteOff() {
    if (!entitlements.stockWriteOff) {
      toast(t.upsellWriteOff, "danger");
      router.push("/premium");
      return;
    }
    setModal("writeoff");
  }

  function openInventory() {
    if (!entitlements.stockInventory) {
      toast(t.upsellInventory, "danger");
      router.push("/premium");
      return;
    }
    setModal("inventory");
  }

  function openHistory(ingredientId?: string) {
    setHistoryIngredientId(ingredientId ?? null);
    setModal("history");
  }

  function renderRemoveButton(row: StockRow) {
    const label = `${t.remove}: ${row.name}`;
    return (
      <button
        type="button"
        className="icon-btn danger shrink-0"
        aria-label={label}
        title={label}
        onClick={() => {
          setRemoveError(undefined);
          setRemoveTarget(row);
        }}
      >
        <Trash2 className="size-[18px]" aria-hidden="true" />
      </button>
    );
  }

  async function confirmRemove() {
    if (!removeTarget || removing) return;
    setRemoving(true);
    setRemoveError(undefined);
    try {
      await removeStockLevel({ venueId: removeTarget.venueId, levelId: removeTarget.id });
      // A refresh started before the delete can still contain the removed level.
      stockVersion.current += 1;
      setRows((current) => current.map((row) => row.id === removeTarget.id
        ? { ...row, id: `virtual-${row.ingredientId}`, hasLevel: false, qty: 0, min: 0, usedToday: 0 }
        : row));
      refreshLiveStock.current();
      setRemoveTarget(null);
      document.getElementById("stock-levels")?.focus({ preventScroll: true });
      toast(t.removeSuccess, "success");
    } catch {
      setRemoveError(t.removeError);
    } finally {
      setRemoving(false);
    }
  }

  async function copyBuyList() {
    const text = formatBuyListClipboard(buyList);
    try {
      await navigator.clipboard.writeText(text);
      toast(t.buyCopied);
    } catch {
      toast(t.buyCopied, "default");
    }
  }

  const historyName =
    rows.find((r) => r.ingredientId === historyIngredientId)?.name ?? null;

  const stockCountHint = stockUnlimited
    ? `${stockItemCount} · ${t.kpiUnlimited}`
    : `${stockItemCount} od ${maxStockItems} na ${planDisplayName(plan)} planu`;

  if (!venueId) {
    return (
      <div className="stock-page">
        <PageHeader title={t.title} description={t.subtitle} />
        {loadError ? <RouteError message={t.loadError} /> : <EmptyState title={t.noVenue}
          action={<StateLink href="/dashboard">Otvori tablu</StateLink>} />}
      </div>
    );
  }

  return (
    <div className="stock-page">
      <PageHeader
        title={t.title}
        description={t.subtitle}
        className="mb-5 [&>div:last-child]:max-w-full"
        action={
          <>
            {canPush ? (
              <button
                id="btnStockBell"
                type="button"
                className="icon-btn bordered stock-bell"
                aria-label={`${alertsText.notifications} (${notifications.length})`}
                disabled={notifications.length === 0}
                onClick={() =>
                  toast(notifications.join(", "), {
                    tone: "warning",
                    durationMs: 6000,
                  })
                }
              >
                <Bell className="size-5" aria-hidden="true" />
                {notifications.length > 0 ? (
                  <span className="stock-bell-count" aria-hidden="true">
                    {notifications.length}
                  </span>
                ) : null}
              </button>
            ) : null}
            <PrimaryButton
              variant="secondary"
              leftIcon={<Minus aria-hidden="true" />}
              onClick={openWriteOff}
            >
              {t.writeOff}
            </PrimaryButton>
            <PrimaryButton
              variant="secondary"
              leftIcon={<Scale aria-hidden="true" />}
              onClick={openInventory}
            >
              {t.inventory}
            </PrimaryButton>
            <PrimaryButton
              variant="secondary"
              leftIcon={<Utensils aria-hidden="true" />}
              onClick={() => {
                setSaleMounted(true);
                setModal("sale");
              }}
            >
              {t.sale}
            </PrimaryButton>
            <PrimaryButton
              leftIcon={<Plus aria-hidden="true" />}
              onClick={() => openRestock()}
            >
              {t.restockPrimary}
            </PrimaryButton>
          </>
        }
      />

      {showUsage ? (
        <UsageStrip
          label={t.kpiItems}
          used={stockItemCount}
          max={stockUnlimited ? Math.max(stockItemCount, 1) : maxStockItems}
          isPremium={stockUnlimited}
          planLabel={planDisplayName(plan)}
          className="stock-usage !mb-0 !gap-x-4"
        />
      ) : null}

      {overStockLimit ? (
        <p className="rounded-[10px] border border-warning/40 bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--text-2)]">
          {t.overLimitBanner}
        </p>
      ) : null}

      {!isPlanLoading && leadAlert ? (
        <div className="grid gap-3">
          <section
            id="stockRunoutStrip"
            className={cn("alert-strip", !leadAlert.soon && "danger")}
            aria-labelledby="stock-runout-heading"
          >
            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p id="stock-runout-heading" className="font-semibold">
                {leadAlert.soon
                  ? alertsText.soonTitle(runoutSoon.length)
                  : alertsText.goneTitle(gone.length)}
              </p>
              <p className="text-[var(--text-2)]">
                {leadAlert.soon ? soonNames.join(", ") : `${goneNames.join(", ")} — ${alertsText.stockZero}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {leadAlert.soon ? (
                <PrimaryButton size="sm" variant="secondary" onClick={showRunoutRows}>
                  {alertsText.filter}
                </PrimaryButton>
              ) : null}
              <a href="#stock-buy-list" className="stock-buy-link">
                {t.buyTitle}
              </a>
            </div>
          </section>
          {canPush ? (
            <aside id="stockPushBanner" className="push-banner" aria-label={alertsText.notifications}>
              <span className="stock-push-icon">
                <Bell className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="stock-push-label">{alertsText.pushLabel}</p>
                <p className="font-semibold text-text">
                  {leadAlert.soon
                    ? alertsText.pushSoon(leadAlert.row.name, shiftEta(leadAlert.remainingShifts, ""))
                    : alertsText.pushGone(leadAlert.row.name)}
                </p>
                <p className="text-[var(--text-2)]">
                  {notifications.length > 1 ? notifications.slice(1).join(", ") : alertsText.projection}
                </p>
              </div>
              <span className="self-start text-[var(--text-3)]">{alertsText.pushTime}</span>
            </aside>
          ) : null}
        </div>
      ) : null}

      <div className="attention-row">
        <span className="attention-label">{t.attention}</span>
        {critical > 0 ? (
          <span className="attention-chip" data-stock-status="crit">
            <span className="dot" aria-hidden="true" />
            {critical} {canWarn ? alertsText.critical.toLowerCase() : t.chipOut}
          </span>
        ) : null}
        {warnings > 0 ? (
          <span className="attention-chip" data-stock-status="warn">
            <span className="dot" aria-hidden="true" />
            {warnings} {t.chipLow}
          </span>
        ) : null}
        {noLevel > 0 ? (
          <button
            type="button"
            className="attention-chip"
            data-stock-status="bez"
            onClick={() => openRestock()}
          >
            <span className="dot" aria-hidden="true" />
            {noLevel} {t.chipNoStock}
          </button>
        ) : null}
        {critical === 0 && warnings === 0 && noLevel === 0 ? (
          <span className="attention-chip" data-stock-status="ok">
            <span className="dot" aria-hidden="true" />
            {t.chipOk}
          </span>
        ) : null}
      </div>

      <div id="stockKpis" className="stock-kpis">
        <KpiCard
          label={t.kpiItems}
          value={stockItemCount}
          hint={stockCountHint}
          icon={<Boxes className="size-5" />}
        />
        <KpiCard
          label={t.kpiLow}
          value={critical + warnings}
          hint={
            critical > 0 ? (
              <>
                <span className="font-bold text-danger">
                  {critical} {t.chipOut}
                </span>
                {warnings > 0 ? ` · ${warnings} ${t.kpiLowFoot}` : null}
              </>
            ) : belowMin > 0 ? (
              `${belowMin} ${t.kpiBelowMinShort}`
            ) : (
              t.kpiAllInStock
            )
          }
          icon={<AlertTriangle className="size-5" />}
        />
        <KpiCard
          label={t.kpiUsedToday}
          value={formatMoney(usedValue)}
          suffix={t.din}
          hint={t.kpiUsedTodayFoot}
          highlight
          icon={<ChartNoAxesCombined className="size-5" />}
        />
        <KpiCard
          label={t.kpiValue}
          value={formatMoney(value)}
          suffix={t.din}
          hint={t.kpiValueFoot}
          highlight
          icon={<Wallet className="size-5" />}
        />
      </div>

      {loadError ? <RouteError message={t.loadError} /> : null}
      {(!loadError || rows.length > 0) && (
        <BentoCard
          id="stock-levels"
          className="scroll-mt-24"
          tabIndex={-1}
          flush={filtered.length > 0 && view === "table"}
          bodyClassName={
            filtered.length === 0
              ? undefined
              : view === "cards"
                ? "p-5"
                : undefined
          }
          header={
            <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-3">
              <label className="field-input w-full md:w-[46%] md:max-w-[480px]">
                <Search className="size-4" aria-hidden="true" />
                <span className="sr-only">{t.searchPlaceholder}</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder={t.searchPlaceholder}
                />
              </label>
              <SegmentedControl
                ariaLabel={t.viewTable}
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  {
                    value: "table",
                    label: t.viewTable,
                    icon: <Table2 className="size-4" aria-hidden="true" />,
                  },
                  {
                    value: "cards",
                    label: t.viewCards,
                    icon: <LayoutGrid className="size-4" aria-hidden="true" />,
                  },
                ]}
              />
              {filterRunout ? (
                <PrimaryButton size="sm" variant="secondary" onClick={() => setOnlyRunout(false)}>
                  {alertsText.clearFilter}
                </PrimaryButton>
              ) : null}
              <span className="ml-auto text-[length:var(--fs-sm)] text-[var(--text-3)]">
                {t.sortHint}
              </span>
            </div>
          }
          footer={
            <>
              <span>
                {pageCount > 1 ? `${start + 1}–${start + visibleStock.length}` : filtered.length} {t.footerShown} {pageCount > 1 ? filtered.length : stockItemCount} {t.footerItems}
              </span>
              {pageCount > 1 ? (
                <div className="flex gap-2">
                  <PrimaryButton size="sm" variant="secondary" disabled={currentPage === 0} onClick={() => changeStockPage(currentPage - 1)}>Prethodna</PrimaryButton>
                  <PrimaryButton size="sm" variant="secondary" disabled={currentPage + 1 === pageCount} onClick={() => changeStockPage(currentPage + 1)}>Sledeća</PrimaryButton>
                </div>
              ) : null}
            </>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="size-6" />}
              title={filterRunout ? alertsText.filteredEmpty : query.trim() ? "Nema rezultata pretrage." : t.emptyTitle}
              description={filterRunout || query.trim() ? undefined : t.emptyHint}
              actionLabel={filterRunout || query.trim() ? alertsText.clearFilter : t.restockPrimary}
              onAction={() => {
                if (filterRunout || query.trim()) {
                  setOnlyRunout(false);
                  setQuery("");
                } else {
                  openRestock();
                }
              }}
            />
          ) : view === "table" ? (
            <div className="mise-scroll stock-table-scroll overflow-auto" role="region" aria-label={t.title} tabIndex={0}>
              <table className="mise-table stock-table">
                <thead>
                  <tr>
                    <th scope="col" className="w-1/5">
                      {t.colIngredient}
                    </th>
                    <th scope="col" className="num">
                      {t.colOnHand}
                    </th>
                    <th scope="col" className="num col-min" tabIndex={-1}>
                      {t.colMin}
                    </th>
                    <th scope="col" className="hide-sm num">
                      {t.colUsedToday}
                    </th>
                    <th scope="col">{t.colStatus}</th>
                    <th scope="col" className="hide-sm">
                      {t.colLevel}
                    </th>
                    <th scope="col">
                      <span className="sr-only">{t.actions}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStock.map(({ row, status, soon, remainingShifts }) => {
                    const used = effectiveUsedToday(row);
                    return (
                      <tr key={row.ingredientId} className={stockRail(canWarn, status)}>
                        <td>
                          <div className="flex items-center gap-3">
                            <IngredientThumb name={row.name} />
                            <div className="min-w-0">
                              <p className="font-semibold text-text">
                                {row.name}
                              </p>
                              <p className="text-[length:var(--fs-sm)] text-[var(--text-3)] max-sm:!text-xs">
                                {formatMoney(row.price, {
                                  fractionDigits: 2,
                                })}{" "}
                                {t.din}/{row.unit}
                              </p>
                              {soon ? <p className="shift-eta">{shiftEta(remainingShifts)}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="num">
                          {row.hasLevel ? (
                            <>
                              <span className="stock-qty">
                                {formatQty(row.qty)}
                              </span>
                              <span className="stock-qty-unit">{row.unit}</span>
                            </>
                          ) : (
                            <span className="text-[var(--text-3)]">—</span>
                          )}
                        </td>
                        <td className="num col-min">
                          <StockMinimum
                            row={row}
                            onSetUp={() => openRestock(row.ingredientId)}
                            onSaved={(min) => {
                              setRows((current) => current.map((item) => item.id === row.id ? { ...item, min } : item));
                              refreshLiveStock.current();
                              document.querySelector<HTMLElement>("th.col-min")?.focus();
                            }}
                          />
                        </td>
                        <td className="hide-sm num">
                          {row.hasLevel ? (
                            <>
                              {formatQty(used)} {row.unit}
                            </>
                          ) : (
                            <span className="text-[var(--text-3)]">—</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={status} canWarn={canWarn} />
                        </td>
                        <td className="hide-sm min-w-[120px]">
                          <StockLevel row={row} status={status} compact />
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1 max-sm:gap-0">
                            <PrimaryButton
                              size="sm"
                              variant="secondary"
                              className="stock-restock max-sm:!size-11 max-sm:!p-0"
                              leftIcon={<Plus aria-hidden="true" />}
                              aria-label={`${t.restock} ${row.name}`}
                              onClick={() => openRestock(row.ingredientId)}
                            >
                              <span className="max-sm:sr-only">{t.restock}</span>
                            </PrimaryButton>
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={t.history}
                              onClick={() => openHistory(row.ingredientId)}
                            >
                              <History className="size-[18px]" aria-hidden="true" />
                            </button>
                            {renderRemoveButton(row)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleStock.map(({ row, status, soon, remainingShifts }) => {
                return (
                  <article
                    key={row.ingredientId}
                    className={cn(
                      "flex flex-col gap-3 rounded-[14px] border border-border bg-surface-2 p-4",
                      stockRail(canWarn, status)
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <IngredientThumb name={row.name} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-text">
                            {row.name}
                          </p>
                          <p className="text-[length:var(--fs-sm)] text-[var(--text-3)]">
                            min {row.hasLevel && row.min > 0 ? `${formatQty(row.min)} ${row.unit}` : "—"}
                          </p>
                          {soon ? <p className="shift-eta">{shiftEta(remainingShifts)}</p> : null}
                        </div>
                      </div>
                      <StatusBadge status={status} canWarn={canWarn} />
                    </div>
                    <p>
                      {row.hasLevel ? (
                        <>
                          <span className="stock-qty">
                            {formatQty(row.qty)}
                          </span>
                          <span className="stock-qty-unit">{row.unit}</span>
                        </>
                      ) : (
                        <span className="text-[var(--text-3)]">—</span>
                      )}
                    </p>
                    <StockLevel row={row} status={status} />
                    <div className="mt-auto flex gap-2">
                      <PrimaryButton
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        leftIcon={<PackagePlus aria-hidden="true" />}
                        onClick={() => openRestock(row.ingredientId)}
                      >
                        {t.restock}
                      </PrimaryButton>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t.history}
                        onClick={() => openHistory(row.ingredientId)}
                      >
                        <History className="size-[18px]" aria-hidden="true" />
                      </button>
                      {renderRemoveButton(row)}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </BentoCard>
      )}

      <BentoCard
        id="stock-buy-list"
        className="stock-buy scroll-mt-24"
        flush
        headerClassName="!px-6 !py-5"
        header={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[length:var(--fs-md)] font-semibold text-text">
                {t.buyTitle}
                <span className="count-pill">{buyList.length}</span>
              </p>
              <p className="mt-0.5 text-[length:var(--fs-sm)] text-[var(--text-2)]">
                {t.buySub}
              </p>
            </div>
            <PrimaryButton
              size="sm"
              variant="secondary"
              leftIcon={<Copy aria-hidden="true" />}
              disabled={buyList.length === 0}
              onClick={() => void copyBuyList()}
            >
              {t.buyCopy}
            </PrimaryButton>
          </div>
        }
      >
        {buyList.length === 0 ? (
          stock.some(({ row }) => row.min <= 0) ? (
            <div className="buy-setup">
              <span className="buy-setup-icon">
                <Package aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text">{t.setupMinsTitle}</p>
                <p className="mt-1 text-sm text-[var(--text-2)]">
                  {t.setupMinsMissing}
                </p>
              </div>
              <PrimaryButton onClick={focusSetMins}>{t.setupMins}</PrimaryButton>
            </div>
          ) : (
            <EmptyState
              icon={<Package className="size-6" aria-hidden="true" />}
              title={t.buyEmptyTitle}
              description={t.buyEmptyHint}
              className="px-6 py-8"
            />
          )
        ) : (
          <ul className="divide-y divide-border">
            {buyList.map((item) => (
              <li
                key={item.ingredientId}
                className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <IngredientThumb name={item.name} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">
                      {item.name}
                    </p>
                    <p className="text-[length:var(--fs-sm)] text-[var(--text-3)]">
                      {t.buyOnHand} {formatQty(item.qty)} {item.unit} ·{" "}
                      {t.buyMin} {formatQty(item.min)} {item.unit}
                    </p>
                  </div>
                  <StatusBadge status={statusById.get(item.ingredientId) ?? "ok"} canWarn={canWarn} />
                </div>
                <p className="ml-auto text-right text-[length:var(--fs-base)] font-semibold tabular-nums text-warning">
                  + {formatQty(item.need)} {item.unit}
                </p>
              </li>
            ))}
          </ul>
        )}
      </BentoCard>

      <ConfirmSheet
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => void confirmRemove()}
        title={t.remove}
        description={removeTarget ? t.removeConfirm(removeTarget.name) : undefined}
        confirmLabel={t.remove}
        error={removeError}
        loading={removing}
        danger
      />
      {saleMounted ? <SaleModal
        open={modal === "sale"}
        onClose={() => setModal(null)}
        venueId={venueId}
        recipes={recipes}
        stockRows={rows}
        userId={entitlements.stockMoveAudit ? userId : null}
        onOpenRestock={() => openRestock()}
        onSaved={() => refreshLiveStock.current()}
      /> : null}
      {modal === "restock" ? <RestockModal
        open={modal === "restock"}
        onClose={() => setModal(null)}
        venueId={venueId}
        rows={rows}
        preferIngredientId={restockPrefer}
        userId={entitlements.stockMoveAudit ? userId : null}
        canSetPrice={entitlements.stockRestock}
        maxStockItems={stockUnlimited ? undefined : maxStockItems}
        stockItemCount={stockItemCount}
        onLimitReached={openStockLimit}
        onSaved={refresh}
      /> : null}
      {modal === "writeoff" ? <WriteOffModal
        open={modal === "writeoff"}
        onClose={() => setModal(null)}
        venueId={venueId}
        rows={rows.filter((row) => row.hasLevel)}
        userId={entitlements.stockMoveAudit ? userId : null}
        onSaved={() => refreshLiveStock.current()}
      /> : null}
      {modal === "inventory" ? <InventoryModal
        open={modal === "inventory"}
        onClose={() => setModal(null)}
        venueId={venueId}
        rows={rows}
        userId={entitlements.stockMoveAudit ? userId : null}
        onSaved={() => refreshLiveStock.current()}
      /> : null}
      {modal === "history" ? <HistorySheet
        open={modal === "history"}
        onClose={() => setModal(null)}
        venueId={venueId}
        ingredientId={historyIngredientId}
        ingredientName={historyName}
      /> : null}
    </div>
  );
}

const ingredientThumbs = [
  {
    pattern: /\b(lepinj\w*|hleb\w*|peciv\w*)\b/i,
    Icon: Sandwich,
    color: "[--stock-tint:var(--warning)]",
  },
  {
    pattern: /\b(meso|junetin\w*|piletin\w*|svinjetin\w*)\b/i,
    Icon: Beef,
    color: "[--stock-tint:var(--danger)]",
  },
  {
    pattern: /\b(luk|luka)\b/i,
    Icon: Vegan,
    color: "[--stock-tint:#c5a7ff]",
  },
  {
    pattern: /\bparadajz\w*/i,
    Icon: Apple,
    color: "[--stock-tint:#ff829f]",
  },
  {
    pattern: /(?:^|\s)[šs]argarep\w*/i,
    Icon: Carrot,
    color: "[--stock-tint:var(--accent)]",
  },
];

function IngredientThumb({ name }: { name: string }) {
  const thumb = ingredientThumbs.find(({ pattern }) => pattern.test(name));
  const Icon = thumb?.Icon ?? Package;
  return (
    <span
      className={cn("ing-thumb", thumb && "stock-tinted", thumb?.color)}
      aria-hidden="true"
    >
      <Icon className="size-[22px]" />
    </span>
  );
}

const statusLabels = {
  crit: alertsText.critical,
  warn: alertsText.belowMinimum,
  bez: t.statusNone,
  ok: t.statusOk,
};

function stockRail(canWarn: boolean, status: StockAlertStatus) {
  return canWarn && (status === "crit" || status === "warn") ? `stock-${status}` : undefined;
}

function StatusBadge({ status, canWarn }: { status: StockAlertStatus; canWarn: boolean }) {
  if (status === "bez") {
    return <Badge variant="neutral">{t.statusNone}</Badge>;
  }
  if (status === "ok") {
    return <Badge variant="success">{t.statusOk}</Badge>;
  }
  if (status === "crit") {
    return (
      <Badge variant="danger">
        {canWarn ? statusLabels.crit : t.statusOut}
      </Badge>
    );
  }
  return <Badge variant="warning">{statusLabels.warn}</Badge>;
}

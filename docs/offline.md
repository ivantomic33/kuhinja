# Current offline behavior

- **Cached reads.** `idb-keyval` stores snapshots of recent recipes, ingredients
  and checklist templates in the browser. A cached ingredient price reflects
  the last saved snapshot. [Cache implementation](../lib/offline/cache.ts)
- **Queued writes.** The IndexedDB queue currently accepts checklist-run
  changes. Checklist writes go straight to Supabase while connected. The app
  queues them while offline or when the direct write fails, and the shift
  screen uses the local result. [Queue](../lib/offline/idb.ts) ·
  [Checklist persistence](../lib/offline/checklist-sync.ts)
- **Replay and checklist conflicts.** The app tries to replay on mount and on
  the browser's `online` event. It sends entries in creation order, removes
  successful entries, and stops at the first failure until another flush.
  Upserts reuse the checklist run ID, so repeating an upsert targets the same
  row. For the same run, the last applied write replaces the fields it sends,
  including the entire checked-item list. [Replay](../lib/offline/checklist-sync.ts) ·
  [Connectivity listener](../components/pwa/OfflineSync.tsx)
- **Prices.** Price changes require a live write. Restocking updates the
  ingredient price and inserts a price-history row in separate requests. If
  two devices successfully update the same ingredient price, the last update
  applied by Supabase controls the current price. The database sets
  `updated_at` when it applies the update. An offline price change stays
  outside the replay queue. [Restock writes](../lib/stock/actions.ts) ·
  [Timestamp trigger](../supabase/migrations/20250322000000_initial_schema.sql)
- **Status and sign-out.** The header badge reflects connection status. The
  shift screen tracks its own sync progress. Sign-out clears the local cache
  and pending checklist writes. [Header badge](../components/pwa/OfflineIndicator.tsx) ·
  [Shift screen](../components/shift/ShiftChecklist.tsx) ·
  [Sign-out cleanup](../lib/auth/clear-client-state.ts)

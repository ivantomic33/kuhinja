import type { RealtimeChannel } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/client";

type Client = ReturnType<typeof createClient>;
type Subscription = {
  listeners: Set<() => void>;
  channel?: RealtimeChannel;
  closing: boolean;
};

const registry = new WeakMap<Client, Map<string, Subscription>>();

/** Share the stock feed for a venue within one browser client. */
export function subscribeWorkspaceChannel(
  supabase: Client,
  venueId: string,
  onChange: () => void,
): () => void {
  const channels = registry.get(supabase) ?? new Map<string, Subscription>();
  registry.set(supabase, channels);

  const entry = channels.get(venueId) ?? { listeners: new Set<() => void>(), closing: false };
  channels.set(venueId, entry);
  const listener = () => onChange();
  entry.listeners.add(listener);

  function connect() {
    if (entry.closing || entry.channel || !entry.listeners.size) return;
    const notify = () => {
      if (!entry.closing) entry.listeners.forEach((callback) => callback());
    };
    const filter = { schema: "public", table: "stock_levels", filter: `venue_id=eq.${venueId}` };
    entry.channel = supabase.channel(`workspace:${venueId}`)
      .on("postgres_changes", { ...filter, event: "INSERT" }, notify)
      .on("postgres_changes", { ...filter, event: "UPDATE" }, notify);
    entry.channel.subscribe((status) => {
      if (status === "SUBSCRIBED") notify();
    });
  }

  connect();
  return () => {
    if (!entry.listeners.delete(listener) || entry.listeners.size || !entry.channel || entry.closing) return;
    const channel = entry.channel;
    entry.closing = true;
    void supabase.removeChannel(channel).then((status) => {
      if (status !== "ok") channel.teardown();
    }).catch(() => channel.teardown()).finally(() => {
      entry.channel = undefined;
      entry.closing = false;
      if (entry.listeners.size) connect();
      else channels.delete(venueId);
    });
  };
}

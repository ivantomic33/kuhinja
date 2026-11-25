import { expect, it, vi } from "vitest";
import { subscribeWorkspaceChannel } from "./workspace-channel";

function mockClient() {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn<(channel: unknown) => Promise<string>>().mockResolvedValue("ok"),
  };
  return { channel, client, supabase: client as unknown as Parameters<typeof subscribeWorkspaceChannel>[0] };
}

it("shares one venue-filtered channel and removes it when the last listener unsubscribes", () => {
  const { supabase, client, channel } = mockClient();
  const first = vi.fn();
  const second = vi.fn();
  const offFirst = subscribeWorkspaceChannel(supabase, "local-a", first);
  const offSecond = subscribeWorkspaceChannel(supabase, "local-a", second);

  expect(client.channel).toHaveBeenCalledExactlyOnceWith("workspace:local-a");
  for (const [i, event] of ["INSERT", "UPDATE"].entries()) {
    expect(channel.on).toHaveBeenNthCalledWith(i + 1, "postgres_changes",
      { schema: "public", table: "stock_levels", filter: "venue_id=eq.local-a", event }, expect.any(Function));
  }
  const notify = channel.on.mock.calls[0][2];
  notify();
  offFirst();
  offFirst();
  notify();
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledTimes(2);
  expect(client.removeChannel).not.toHaveBeenCalled();
  offSecond();
  expect(client.removeChannel).toHaveBeenCalledExactlyOnceWith(channel);
});

it("waits for cleanup before opening another subscription for the venue", async () => {
  const { supabase, client } = mockClient();
  const removing = Promise.withResolvers<string>();
  client.removeChannel.mockReturnValueOnce(removing.promise);
  const first = subscribeWorkspaceChannel(supabase, "local-a", vi.fn());
  first();
  const second = subscribeWorkspaceChannel(supabase, "local-a", vi.fn());
  expect(client.channel).toHaveBeenCalledOnce();
  removing.resolve("ok");
  await vi.waitFor(() => expect(client.channel).toHaveBeenCalledTimes(2));
  second();
});

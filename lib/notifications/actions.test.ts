import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/action", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server/action")>();
  return {
    ...actual,
    requireActionUser: vi.fn(),
  };
});

import { requireActionUser } from "@/lib/server/action";
import { listNotifications, markNotificationRead } from "./actions";
import {
  listNotificationsSchema,
  markNotificationReadSchema,
} from "./schemas";

const userId = "11111111-1111-4111-8111-111111111111";
const notificationId = "22222222-2222-4222-8222-222222222222";

describe("notification schemas", () => {
  it("bounds list sizes and validates the notification UUID", () => {
    expect(listNotificationsSchema.parse({}).limit).toBe(50);
    expect(listNotificationsSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(
      markNotificationReadSchema.safeParse({ notificationId }).success,
    ).toBe(true);
    expect(
      markNotificationReadSchema.safeParse({ notificationId: "invalid" })
        .success,
    ).toBe(false);
  });
});

describe("notification actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists notifications only through the authenticated user's query", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: notificationId,
            kind: "ingredient_price_change",
            title: "Promena cene sastojka",
            message: "Cena brašna je porasla.",
            data: { ingredient_name: "Brašno" },
            created_at: "2026-11-26T12:00:00.000Z",
            read_at: null,
          },
        ],
        error: null,
      }),
    };
    vi.mocked(requireActionUser).mockResolvedValue({
      user: { id: userId },
      supabase: { from: vi.fn(() => query) },
    } as never);

    const result = await listNotifications({ limit: 10 });

    expect(query.eq).toHaveBeenCalledWith("user_id", userId);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.data.notifications[0]?.readAt).toBeNull();
  });

  it("marks only the authenticated user's notification as read", async () => {
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: notificationId },
        error: null,
      }),
    };
    vi.mocked(requireActionUser).mockResolvedValue({
      user: { id: userId },
      supabase: { from: vi.fn(() => query) },
    } as never);

    const result = await markNotificationRead({ notificationId });

    expect(query.eq).toHaveBeenNthCalledWith(1, "id", notificationId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "user_id", userId);
    expect("error" in result).toBe(false);
  });
});

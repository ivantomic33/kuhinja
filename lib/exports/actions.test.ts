import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workspace/server", () => ({
  requireWorkspaceMember: vi.fn(),
}));

import { exportKitchenData } from "./actions";
import { requireWorkspaceMember } from "@/lib/workspace/server";

const workspaceId = "11111111-1111-4111-8111-111111111111";

describe("exportKitchenData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates input, enforces workspace membership, and returns a CSV download", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            name: "Brašno",
            unit: "kg",
            price: 120,
            waste_percent: 2,
            notes: null,
          },
        ],
        error: null,
        count: 1,
      }),
    };
    const fakeMember = {
      workspaceId,
      supabase: { from: vi.fn(() => query) },
    };
    vi.mocked(requireWorkspaceMember).mockResolvedValue(fakeMember as never);

    const invalid = await exportKitchenData({
      scope: "ingredients",
      format: "pdf",
      workspaceId,
    });
    expect("error" in invalid && invalid.error.code).toBe("VALIDATION_ERROR");
    expect(requireWorkspaceMember).not.toHaveBeenCalled();

    const result = await exportKitchenData({
      scope: "ingredients",
      format: "csv",
      workspaceId,
    });

    expect(requireWorkspaceMember).toHaveBeenCalledWith("cook", workspaceId);
    expect(query.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.data.fileName).toMatch(/^ingredients-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.data.contentType).toContain("text/csv");
    expect(Buffer.from(result.data.base64, "base64").toString("utf8")).toContain(
      "Brašno",
    );
  });

  it("surfaces denied workspace membership without querying tables", async () => {
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      error: { code: "FORBIDDEN", message: "Nemate dozvolu." },
    });

    const result = await exportKitchenData({
      scope: "recipes",
      format: "csv",
      workspaceId,
    });

    expect(result).toEqual({
      error: { code: "FORBIDDEN", message: "Nemate dozvolu." },
    });
  });

  it("generates a recipe PDF card through the authenticated export action", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            name: "Dnevna čorba",
            description: "Sezonsko povrće",
            portions: 2,
            selling_price: 500,
            recipe_items: [
              {
                quantity: 0.5,
                ingredients: {
                  name: "Šargarepa",
                  unit: "kg",
                  price: 200,
                  waste_percent: 0,
                },
              },
            ],
          },
        ],
        error: null,
        count: 1,
      }),
    };
    vi.mocked(requireWorkspaceMember).mockResolvedValue({
      workspaceId,
      supabase: { from: vi.fn(() => query) },
    } as never);

    const result = await exportKitchenData({
      scope: "recipes",
      format: "pdf",
      workspaceId,
      recipeId: "22222222-2222-4222-8222-222222222222",
    });

    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.data.fileName).toMatch(/^dnevna-corba-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(result.data.contentType).toBe("application/pdf");
    expect(Buffer.from(result.data.base64, "base64").subarray(0, 5).toString())
      .toBe("%PDF-");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import SchedulePage from "@/app/(app)/raspored/page";
import { getPlan } from "@/lib/supabase/plan-server";
import { loadSchedule } from "./server";

vi.mock("@/lib/supabase/plan-server", () => ({ getPlan: vi.fn() }));
vi.mock("./server", () => ({ loadSchedule: vi.fn() }));
vi.mock("@/components/schedule/ScheduleWorkspace", () => ({ ScheduleWorkspace: () => "Radni raspored" }));

const props = { searchParams: Promise.resolve({}) };

it("sends failed loads to the retry boundary even for a Free account", async () => {
  vi.mocked(getPlan).mockResolvedValue("free");
  vi.mocked(loadSchedule).mockRejectedValue(new Error("Network unavailable"));
  await expect(SchedulePage(props)).rejects.toThrow("Network unavailable");
});

it("offers a way back to setup when a paid account has no schedule location", async () => {
  vi.mocked(getPlan).mockResolvedValue("starter");
  vi.mocked(loadSchedule).mockResolvedValue(null);
  const html = renderToStaticMarkup(await SchedulePage(props));
  expect(html).toContain("Nema lokala za raspored");
  expect(html).toContain('href="/dashboard"');
});

it("renders an upgrade link instead of schedule controls for a Free owner", async () => {
  vi.mocked(loadSchedule).mockResolvedValue(null);
  vi.mocked(getPlan).mockResolvedValue("free");

  const html = renderToStaticMarkup(await SchedulePage(props));

  expect(html).toContain("Raspored smena je dostupan od Starter paketa.");
  expect(html).toContain('href="/premium"');
  expect(html).not.toContain("Radni raspored");
});

it("allows a Free employee to open the schedule of their Team employer", async () => {
  vi.mocked(getPlan).mockResolvedValue("free");
  vi.mocked(loadSchedule).mockResolvedValue({
    mode: "employee",
    plan: "team",
    venue: { id: "team-location", name: "Lokal" },
    locations: [],
    monday: "2026-11-16",
    today: "2026-11-20",
    employees: [],
    assignments: [],
    publication: null,
    requests: [],
    coworkers: [],
    notifications: [],
  });

  expect(renderToStaticMarkup(await SchedulePage(props))).toContain("Radni raspored");
});

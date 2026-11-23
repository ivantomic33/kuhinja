import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";
import { analyzeWeek } from "./math";
import type { Assignment, Employee } from "./types";

const employee: Employee = {
  id: "a",
  full_name: "Ana Jović",
  role: "Kuvar",
  hourly_rate_rsd: 500,
};

const assignment: Assignment = {
  employee_id: "a",
  date: "2026-11-16",
  code: "J",
  custom_start: null,
  custom_end: null,
};

function renderGrid(showPro: boolean, assignments = [assignment]) {
  return renderToStaticMarkup(createElement(ScheduleGrid, {
    monday: "2026-11-16",
    today: "2026-11-16",
    employees: [employee],
    assignments,
    analysis: analyzeWeek([employee], assignments, "2026-11-16"),
    showPro,
    onAddEmployee: vi.fn(),
    onSave: vi.fn(),
  }));
}

describe("schedule grid", () => {
  it("shows employee and week hours on Starter and gates cost and warning labels", () => {
    const html = renderGrid(false);
    expect(html).toContain(">Sati</th>");
    expect(html.match(/>8 h</g)).toHaveLength(2);
    expect(html).toContain("Pokrivenost");
    expect(html).not.toContain("4.000 din");
    expect(html).not.toContain("Uveče 0");
  });

  it("shows a Pro coverage warning and an actionable mobile gap card", () => {
    const html = renderGrid(true);
    expect(html).toContain("4.000 din");
    expect(html).toContain("Uveče 0");
    expect(html).toContain("Niko nije u smeni.");
  });

  it("makes an unassigned employee reachable from the default mobile day view", () => {
    const html = renderGrid(false, []).split('class="r-mobile"')[1];
    expect(html).toContain("Nije dodeljeno");
    expect(html).toMatch(
      /<button[^>]+aria-haspopup="dialog"[^>]*>Ana<span class="sr-only"> Jović · Ponedeljak 16.11. · <\/span><span class="sr-only">Nije dodeljeno<\/span>/
    );
  });
});

import { expect, it } from "vitest";
import { getSchedulePreview, scheduleSharePath, scheduleShareToken } from "./exports-preview";

it("builds a weekly preview with shift text and no employee identifiers", () => {
  const preview = getSchedulePreview({
    venueName: "Dorćol",
    monday: "2026-11-16",
    employees: [{ id: "employee-identifier", full_name: "Ana P." }],
    assignments: [
      { employee_id: "employee-identifier", date: "2026-11-16", code: "N", custom_start: null, custom_end: null },
      { employee_id: "employee-identifier", date: "2026-11-17", code: "X", custom_start: "07:30", custom_end: "15:00" },
      { employee_id: "employee-identifier", date: "2026-11-18", code: "B", custom_start: null, custom_end: null },
    ],
  }, "2026-11-17");

  expect(preview.week).toBe("Nedelja 47 · 16.11.–22.11.");
  expect(preview.days.filter(({ today }) => today).map(({ label }) => label)).toEqual(["Uto 17."]);
  expect(preview.rows[0].cells.map((cell) => cell?.text)).toEqual(["22–06", "07:30–15", "Bol.", undefined, undefined, undefined, undefined]);
  expect(JSON.stringify(preview)).not.toContain("employee-identifier");
});

it("builds a readable public URL and recovers its opaque token", () => {
  const token = "a98b0261-e7d1-464a-8811-f108765d431e";
  const path = scheduleSharePath("Đeram & Dorćol", "2026-11-16", token);

  expect(path).toBe("/r/djeram-dorcol-n47-a98b0261-e7d1-464a-8811-f108765d431e");
  expect(scheduleShareToken(path.slice(3))).toBe(token);
  expect(scheduleShareToken(token)).toBe(token);
  expect(scheduleShareToken(`${token}-unexpected`)).toBeNull();
});

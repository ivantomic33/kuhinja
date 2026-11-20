import { expect, it, vi } from "vitest";
import {
  addDays,
  analyzeWeek,
  assignmentHours,
  assignmentTime,
  formatHours,
  getMonthlyReport,
  shortDate,
  todayBelgrade,
  weekDates,
  weekNumber,
  weekStart,
} from "./math";
import type { Assignment, Employee, ShiftCode } from "./types";

const monday = "2026-11-16";
const employee: Employee = { id: "e1", full_name: "Nikola Petrović", role: "Kuvar", hourly_rate_rsd: 500 };

function assignment(
  date: string,
  code: ShiftCode,
  custom_start: string | null = null,
  custom_end: string | null = null,
): Assignment {
  return { employee_id: employee.id, date, code, custom_start, custom_end };
}

it("uses the Belgrade date past local midnight", () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-11-15T23:30:00Z"));
    expect(todayBelgrade()).toBe(monday);
  } finally {
    vi.useRealTimers();
  }
});

it("navigates ISO weeks across a year boundary and a daylight saving change", () => {
  expect(weekStart("2021-01-03")).toBe("2020-12-28");
  expect(weekNumber("2020-12-28")).toBe(53);
  expect(weekNumber("2021-01-04")).toBe(1);
  expect(weekNumber("2018-12-31")).toBe(1);
  expect(weekDates("2026-03-23")).toEqual([
    "2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29",
  ]);
  expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  expect(shortDate("2026-03-07")).toBe("07.03.");
});

it("handles overnight/custom shifts and 24-hour equal times, with no hours for absences", () => {
  const custom = assignment(monday, "X", "23:30:00", "07:00:00");
  expect(assignmentTime(custom)).toBe("23:30–07");
  expect(assignmentTime(assignment(monday, "N"))).toBe("22–06");
  expect(assignmentHours(custom)).toBe(7.5);
  expect(assignmentHours(assignment(monday, "X", "07:00", "07:00"))).toBe(24);
  expect(assignmentHours(assignment(monday, "N"))).toBe(8);
  expect(assignmentHours(assignment(monday, "D"))).toBe(12);
  expect(assignmentHours(assignment(monday, "O"))).toBe(0);
  expect(assignmentHours(assignment(monday, "B"))).toBe(0);
  expect(assignmentHours(assignment(monday, "G"))).toBe(0);
  expect(formatHours(7.5)).toBe("7,5");
});

it("counts coverage and flags gaps only on assigned days for the visible employees", () => {
  const assignments = [
    assignment("2026-11-16", "D"),
    assignment("2026-11-17", "B"),
    assignment("2026-11-18", "X", "12:00", "17:30"),
    assignment("2026-11-19", "X", "20:00", "00:00"),
    assignment("2026-11-20", "N"),
    { ...assignment("2026-11-21", "J"), employee_id: "hidden" },
    assignment("2026-11-23", "J"),
  ];
  const { coverage, employees, hours, cost, warnings } = analyzeWeek([employee], assignments, monday);

  expect(coverage).toEqual([
    { j: 1, p: 1, n: 0 }, { j: 0, p: 0, n: 0 }, { j: 0, p: 1, n: 0 },
    { j: 0, p: 0, n: 1 }, { j: 0, p: 0, n: 1 }, { j: 0, p: 0, n: 0 }, { j: 0, p: 0, n: 0 },
  ]);
  expect(warnings.map(({ day, gap }) => [day, gap])).toEqual([
    [1, "j"], [1, "p"], [2, "j"], [3, "j"], [3, "p"], [4, "j"], [4, "p"],
  ]);
  expect(warnings[0]).toMatchObject({ level: "danger", title: "Uto 17.11. ujutru", tag: "Rupa", chip: "Uto ujutru 0" });
  expect(employees).toEqual([{ employee, hours: 29.5, cost: 14750 }]);
  expect({ hours, cost }).toEqual({ hours: 29.5, cost: 14750 });
});

it("marks both cells for overlap and only the later cell for insufficient rest", () => {
  const assignments = [
    assignment("2026-11-20", "X", "05:30", "13:30"),
    assignment("2026-11-16", "P"),
    assignment("2026-11-17", "J"),
    assignment("2026-11-19", "N"),
    assignment("2026-11-21", "X", "00:30", "12:30"),
    assignment("2026-11-15", "N"),
  ];
  const warnings = analyzeWeek([employee], assignments, monday).warnings.filter((warning) => warning.employeeId);
  expect(warnings).toMatchObject([
    {
      level: "warn", title: "Nikola · Pon → Uto", tag: "Odmor < 11 h", day: 1, chip: "Nikola: 8 h odmora",
      cellMessages: [{ day: 1, text: "Samo 8 h odmora posle smene u Pon (min. 11 h)" }],
    },
    {
      level: "danger", title: "Nikola · Čet i Pet", day: 4, tag: "Preklapanje",
      text: "Smene se preklapaju 0,5 h (noćna do 06, sledeća od 05:30).",
      cellMessages: [{ day: 4, text: "Preklapanje sa smenom od Čet (0,5 h)" }, { day: 3, text: "Preklapanje sa smenom u Pet (0,5 h)" }],
    },
  ]);
});

it("keeps Starter hours and coverage without calculating warnings", () => {
  const assignments = [assignment(monday, "P"), assignment("2026-11-17", "J")];
  const summary = analyzeWeek([employee], assignments, monday, false);

  expect(summary.hours).toBe(16);
  expect(summary.coverage.slice(0, 2)).toEqual([{ j: 0, p: 1, n: 0 }, { j: 1, p: 0, n: 0 }]);
  expect(summary.warnings).toEqual([]);
});

it("flags all seven worked days and only totals above 48 hours", () => {
  const worked = Array.from({ length: 7 }, (_, day) => assignment(`2026-11-${16 + day}`, "J"));
  const rowWarnings = analyzeWeek([employee], worked, monday).warnings.filter((warning) => warning.rowMessage);
  expect(rowWarnings).toMatchObject([
    { tag: "Bez slobodnog", rowMessage: "7 dana bez slobodnog dana", chip: "Nikola: 7 dana bez slobodnog" },
    { tag: "Preko 48 h", rowMessage: "56 h nedeljno (preko 48 h)" },
  ]);
  expect(rowWarnings[1].chip).toBeUndefined();

  worked[3] = assignment("2026-11-19", "G");
  expect(analyzeWeek([employee], worked, monday).warnings.some((warning) => warning.rowMessage)).toBe(false);
});

it("adds the monthly overtime and night premiums separately and counts absence days", () => {
  const shifts = Array.from({ length: 22 }, (_, index) =>
    assignment(`2026-11-${String(index + 1).padStart(2, "0")}`, index === 0 ? "N" : "J"),
  );
  const unrated = { ...employee, id: "e2", hourly_rate_rsd: null };
  const expected = { hours: 184, night: 8, overtime: 8, sick: 1, leave: 1, cost: 94080 };
  expect(getMonthlyReport([employee, unrated], [
    ...shifts,
    assignment("2026-11-23", "X", "22:00", "06:00"),
    assignment("2026-11-24", "B"),
    assignment("2026-11-25", "G"),
    { ...assignment("2026-11-01", "J"), employee_id: unrated.id },
  ])).toEqual({
    rows: [
      { employee, ...expected },
      { employee: unrated, hours: 8, overtime: 0, night: 0, sick: 0, leave: 0, cost: 0 },
    ],
    totals: { ...expected, hours: 192 },
  });
});

import { belgradeToday } from "../stock/math";
import type { Assignment, Employee, ShiftCode } from "./types";

export { belgradeToday as todayBelgrade };

export const dayShort = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
export const dayLong = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];

const dayMs = 86_400_000;
const hoursFormatter = new Intl.NumberFormat("sr-RS", { maximumFractionDigits: 2 });

export function addDays(day: string, delta: number): string {
  return new Date(Date.parse(day) + delta * dayMs).toISOString().slice(0, 10);
}

export function weekStart(day: string): string {
  const dayOfWeek = new Date(day).getUTCDay();
  return addDays(day, -((dayOfWeek + 6) % 7));
}

export function weekDates(monday: string): string[] {
  return dayShort.map((_, day) => addDays(monday, day));
}

export function weekNumber(monday: string): number {
  const year = addDays(monday, 3).slice(0, 4);
  const firstMonday = weekStart(`${year}-01-04`);
  return (Date.parse(monday) - Date.parse(firstMonday)) / (7 * dayMs) + 1;
}

export function shortDate(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
}

export function formatHours(hours: number): string {
  return hoursFormatter.format(hours);
}

export const shifts: Record<ShiftCode, { name: string; className: string; time?: string; start?: string; end?: string }> = {
  J: { name: "Jutro", className: "t-j", time: "07–15", start: "07:00", end: "15:00" },
  P: { name: "Popodne", className: "t-p", time: "15–23", start: "15:00", end: "23:00" },
  N: { name: "Noć", className: "t-n", time: "22–06", start: "22:00", end: "06:00" },
  D: { name: "Dupla", className: "t-d", time: "10–22", start: "10:00", end: "22:00" },
  X: { name: "Prilagođeno", className: "t-x" },
  O: { name: "Slobodan", className: "off" },
  B: { name: "Bolovanje", className: "abs sick" },
  G: { name: "Godišnji", className: "abs leave" },
};

function shortTime(time: string): string {
  return time.slice(3, 5) === "00" ? time.slice(0, 2) : time.slice(0, 5);
}

function timeInHours(time: string): number {
  return Number(time.slice(0, 2)) + Number(time.slice(3, 5)) / 60;
}

function shiftTimes(assignment: Assignment) {
  const template = shifts[assignment.code];
  const start = assignment.code === "X" ? assignment.custom_start : template.start;
  const end = assignment.code === "X" ? assignment.custom_end : template.end;
  if (!start || !end) return null;

  const from = timeInHours(start);
  const until = timeInHours(end);
  return { from, until: until <= from ? until + 24 : until, start, end };
}

export function assignmentTime(assignment: Assignment): string {
  const times = shiftTimes(assignment);
  return times ? `${shortTime(times.start)}–${shortTime(times.end)}` : "";
}

export function assignmentHours(assignment: Assignment): number {
  const times = shiftTimes(assignment);
  return times ? times.until - times.from : 0;
}

export interface ScheduleWarning {
  id: string;
  level: "danger" | "warn";
  title: string;
  text: string;
  tag: string;
  chip?: string;
  day: number;
  gap?: "j" | "p";
  employeeId?: string;
  cellMessages?: Array<{ day: number; text: string }>;
  rowMessage?: string;
}

const requiredSlots = [
  { slot: "j", when: "ujutru", name: "jutro" },
  { slot: "p", when: "uveče", name: "popodne" },
] as const;

export function analyzeWeek(employees: Employee[], assignments: Assignment[], monday: string, withWarnings = true) {
  const dates = weekDates(monday);
  const byDate = new Map(dates.map((date) => [date, new Map<string, Assignment>()]));
  for (const assignment of assignments) {
    byDate.get(assignment.date)?.set(assignment.employee_id, assignment);
  }

  const coverage = dates.map(() => ({ j: 0, p: 0, n: 0 }));
  const assignedDays = new Set<number>();
  const employeeWarnings: ScheduleWarning[] = [];
  const rows = employees.map((employee) => {
    const worked = dates.flatMap((date, day) => {
      const assignment = byDate.get(date)?.get(employee.id);
      if (!assignment) return [];
      if (withWarnings) assignedDays.add(day);

      const times = shiftTimes(assignment);
      if (!times) return [];

      const { code } = assignment;
      if (code === "X") {
        const slot = times.from < 12 ? "j" : times.from < 20 ? "p" : "n";
        coverage[day][slot]++;
      } else {
        if (code === "J" || code === "D") coverage[day].j++;
        if (code === "P" || code === "D") coverage[day].p++;
        if (code === "N") coverage[day].n++;
      }
      return [{ day, ...times }];
    });

    const hours = worked.reduce((total, shift) => total + shift.until - shift.from, 0);
    const row = { employee, hours, cost: hours * (employee.hourly_rate_rsd ?? 0) };
    if (!withWarnings) return row;

    const firstName = employee.full_name.trim().split(/\s+/)[0];
    for (let index = 1; index < worked.length; index++) {
      const previous = worked[index - 1];
      const current = worked[index];
      const gap = (current.day - previous.day) * 24 + current.from - previous.until;
      if (gap >= 11) continue;

      const previousDay = dayShort[previous.day];
      const currentDay = dayShort[current.day];
      const duration = `${formatHours(Math.abs(gap))} h`;
      const position = { employeeId: employee.id, day: current.day };
      if (gap < 0) {
        employeeWarnings.push({
          ...position,
          id: `${employee.id}-overlap-${current.day}`,
          level: "danger",
          title: `${firstName} · ${previousDay} i ${currentDay}`,
          text: `Smene se preklapaju ${duration} (noćna do ${shortTime(previous.end)}, sledeća od ${shortTime(current.start)}).`,
          tag: "Preklapanje",
          chip: `${firstName}: preklapanje ${previousDay}/${currentDay}`,
          cellMessages: [
            { day: current.day, text: `Preklapanje sa smenom od ${previousDay} (${duration})` },
            { day: previous.day, text: `Preklapanje sa smenom u ${currentDay} (${duration})` },
          ],
        });
      } else {
        employeeWarnings.push({
          ...position,
          id: `${employee.id}-rest-${current.day}`,
          level: "warn",
          title: `${firstName} · ${previousDay} → ${currentDay}`,
          text: `Samo ${duration} odmora između smena (zakon traži bar 11 h).`,
          tag: "Odmor < 11 h",
          chip: `${firstName}: ${duration} odmora`,
          cellMessages: [{ day: current.day, text: `Samo ${duration} odmora posle smene u ${previousDay} (min. 11 h)` }],
        });
      }
    }

    if (worked.length === 7) {
      employeeWarnings.push({
        id: `${employee.id}-seven-days`, level: "warn", employeeId: employee.id, day: -1,
        title: `${firstName} · cela nedelja`,
        text: "Radi 7 dana zaredom, nema nijedan slobodan dan.",
        tag: "Bez slobodnog",
        chip: `${firstName}: 7 dana bez slobodnog`,
        rowMessage: "7 dana bez slobodnog dana",
      });
    }
    if (hours > 48) {
      const duration = `${formatHours(hours)} h`;
      employeeWarnings.push({
        id: `${employee.id}-weekly-hours`, level: "warn", employeeId: employee.id, day: -1,
        title: `${firstName} · ${duration}`,
        text: "Nedeljni zbir je preko 48 h. Proveri prekovremeni rad.",
        tag: "Preko 48 h",
        rowMessage: `${duration} nedeljno (preko 48 h)`,
      });
    }
    return row;
  });

  const warnings: ScheduleWarning[] = [];
  dates.forEach((date, day) => {
    if (!assignedDays.has(day)) return;
    for (const { slot, when, name } of requiredSlots) {
      if (coverage[day][slot]) continue;
      warnings.push({
        id: `gap-${day}-${slot}`, level: "danger", day, gap: slot,
        title: `${dayShort[day]} ${shortDate(date)} ${when}`,
        text: `Niko nije u smeni ${name}. Dodaj bar jednu osobu.`,
        tag: "Rupa",
        chip: `${dayShort[day]} ${when} 0`,
      });
    }
  });

  return {
    coverage,
    employees: rows,
    hours: rows.reduce((total, row) => total + row.hours, 0),
    cost: rows.reduce((total, row) => total + row.cost, 0),
    warnings: warnings.concat(employeeWarnings),
  };
}

/** Assignments should already be scoped to the report month and location. */
export function getMonthlyReport(employees: Employee[], assignments: Assignment[]) {
  const totals = { hours: 0, overtime: 0, night: 0, sick: 0, leave: 0, cost: 0 };
  const rows = employees.map((employee) => ({ employee, ...totals }));
  const byEmployee = new Map(rows.map((row) => [row.employee.id, row]));
  for (const assignment of assignments) {
    const row = byEmployee.get(assignment.employee_id);
    if (!row) continue;
    const hours = assignmentHours(assignment);
    row.hours += hours;
    if (assignment.code === "N") row.night += hours;
    if (assignment.code === "B") row.sick++;
    if (assignment.code === "G") row.leave++;
  }

  for (const row of rows) {
    const rate = row.employee.hourly_rate_rsd ?? 0;
    row.overtime = Math.max(0, row.hours - 176);
    row.cost = row.hours * rate + row.overtime * rate * 0.26 + row.night * rate * 0.26;
    totals.hours += row.hours;
    totals.overtime += row.overtime;
    totals.night += row.night;
    totals.sick += row.sick;
    totals.leave += row.leave;
    totals.cost += row.cost;
  }
  return { rows, totals };
}

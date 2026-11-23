import { shiftScreenColors } from "@/lib/design/tokens";
import { assignmentTime, dayShort, shifts, shortDate, todayBelgrade, weekDates, weekNumber } from "./math";
import type { PublicSchedule, ShiftCode } from "./types";

export const shiftColors = shiftScreenColors;

const nonWorkingLabel: Partial<Record<ShiftCode, string>> = { O: "—", B: "Bol.", G: "God." };
const shareTokenPattern = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*-n\d{1,2}-)?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

export function escapeMarkup(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function scheduleSharePath(venueName: string, monday: string, token: string): string {
  const slug = venueName.toLowerCase().replaceAll("đ", "dj").normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-").slice(0, 60).replace(/^-|-$/g, "") || "lokal";
  return `/r/${slug}-n${weekNumber(monday)}-${token}`;
}

export function scheduleShareToken(segment: string): string | null {
  return segment.match(shareTokenPattern)?.[1] ?? null;
}

export function getSchedulePreview(schedule: PublicSchedule, today = todayBelgrade()) {
  const dates = weekDates(schedule.monday);
  const assignments = new Map(schedule.assignments.map((assignment) => [`${assignment.employee_id}:${assignment.date}`, assignment]));
  return {
    title: `Raspored · ${schedule.venueName}`,
    week: `Nedelja ${weekNumber(schedule.monday)} · ${shortDate(dates[0])}–${shortDate(dates[6])}`,
    days: dates.map((date, day) => ({ date, label: `${dayShort[day]} ${Number(date.slice(-2))}.`, today: date === today })),
    rows: schedule.employees.map((employee) => ({
      name: employee.full_name,
      cells: dates.map((date) => {
        const assignment = assignments.get(`${employee.id}:${date}`);
        if (!assignment) return null;
        const { code } = assignment;
        const time = assignmentTime(assignment);
        return { code, text: nonWorkingLabel[code] ?? time, label: `${shifts[code].name}${time ? ` ${time}` : ""}` };
      }),
    })),
  };
}

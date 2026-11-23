import type { PlanId } from "@/lib/plan/entitlements";

export type TemplateCode = "J" | "P" | "N" | "D";
export type ShiftCode = TemplateCode | "X" | "O" | "B" | "G";

export type PublicEmployee = { id: string; full_name: string };

export type Employee = PublicEmployee & {
  role: string;
  hourly_rate_rsd: number | null;
  login_email?: string | null;
};

export type Assignment = {
  employee_id: string;
  date: string;
  code: ShiftCode;
  custom_start: string | null;
  custom_end: string | null;
};

export type PublicSchedule = {
  venueName: string;
  monday: string;
  employees: PublicEmployee[];
  assignments: Assignment[];
};

export type ScheduleRequestType = "slobodan" | "zamena" | "promena";
export type ScheduleRequestStatus = "novo" | "odobreno" | "odbijeno";

export type ScheduleRequest = {
  id: string;
  employee_id: string;
  employee_name: string;
  with_employee_id: string | null;
  with_employee_name: string | null;
  type: ScheduleRequestType;
  date: string;
  source: Assignment | null;
  to_template_code: TemplateCode | null;
  note: string | null;
  status: ScheduleRequestStatus;
  created_at: string;
};

export type ScheduleWeek = {
  mode: "owner" | "employee";
  plan: PlanId;
  venue: { id: string; name: string };
  locations: Array<{ id: string; name: string; employeeCount: number }>;
  monday: string;
  today: string;
  employees: Employee[];
  assignments: Assignment[];
  publishedAssignments?: Assignment[] | null;
  publication: { publishedAt: string; publisherName: string } | null;
  requests: ScheduleRequest[];
  coworkers: PublicEmployee[];
  notifications: Array<{
    id: string;
    kind: "published" | "odobreno" | "odbijeno";
    monday: string;
    created_at: string;
  }>;
};

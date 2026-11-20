import {
  FREE_MAX_PARALLEL_TIMERS,
  FREE_MAX_TEMPLATES,
} from "@/lib/plan/limits";

export { FREE_MAX_PARALLEL_TIMERS, FREE_MAX_TEMPLATES };

export const SHIFT_QUERY_KEYS = {
  run: (templateId: string) => ["checklist-run", templateId] as const,
  template: (templateId: string) => ["checklist-template", templateId] as const,
} as const;

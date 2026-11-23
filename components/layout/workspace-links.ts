import { Boxes, CalendarDays, ClipboardList, Scale } from "lucide-react";
import { stockSr } from "@/lib/i18n/stock";

export const workspaceLinks = [
  { href: "/raspored", label: "Raspored", icon: CalendarDays },
  { href: "/shift", label: "Smena", icon: ClipboardList },
  { href: "/trebovanje", label: stockSr.nav, icon: Boxes },
  { href: "/scaler", label: "Skaliranje", icon: Scale },
] as const;

export function matchesNavPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

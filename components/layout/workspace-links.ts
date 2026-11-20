import { Boxes, CalendarDays, ClipboardList, Scale } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { stockSr } from "@/lib/i18n/stock";

export const workspaceLinks = [
  { href: "/scaler", label: sr.scaler.title, icon: Scale },
  { href: "/shift", label: sr.shift.title, icon: ClipboardList },
  { href: "/trebovanje", label: stockSr.nav, icon: Boxes },
  { href: "/raspored", label: "Raspored", icon: CalendarDays },
] as const;

export function matchesWorkspace(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

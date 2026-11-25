import type { Metadata } from "next";
import type { ReactNode } from "react";
import ProtectedAppShell from "@/components/layout/ProtectedAppShell";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Protected app shell — session required (middleware + this layout). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <ProtectedAppShell>{children}</ProtectedAppShell>;
}

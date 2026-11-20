import { AuthShell } from "@/components/auth/AuthShell";
import { FormSkeleton } from "@/components/ui/RouteStates";
import { sr } from "@/lib/i18n/sr";

export default function Loading() {
  return <AuthShell title={sr.auth.signIn}><FormSkeleton fields={2} /></AuthShell>;
}

import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { listNotifications } from "@/lib/notifications/actions";

export default async function NotificationsPage() {
  const result = await listNotifications({ limit: 100 });

  if ("error" in result) {
    return <NotificationCenter initialItems={[]} loadError />;
  }

  return <NotificationCenter initialItems={result.data.notifications} />;
}

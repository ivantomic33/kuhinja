"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { markNotificationRead, type NotificationItem } from "@/lib/notifications/actions";
import { sr } from "@/lib/i18n/sr";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("sr-Latn", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function NotificationCenter({
  initialItems,
  loadError = false,
}: {
  initialItems: NotificationItem[];
  loadError?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  async function markRead(id: string) {
    if (updating) return;
    setUpdating(id);
    try {
      const result = await markNotificationRead({ notificationId: id });
      if ("error" in result) {
        toast(result.error.message, "danger");
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, readAt: result.data.readAt } : item,
        ),
      );
    } catch (error) {
      console.error("Could not mark notification as read", error);
      toast(sr.notifications.markFailed, "danger");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <main className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={sr.notifications.title}
        description={sr.notifications.description}
      />

      {loadError ? (
        <p role="alert" className="text-sm text-danger">
          {sr.notifications.loadFailed}
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <Bell className="mx-auto mb-2 size-6 text-muted" aria-hidden="true" />
          <p className="text-sm text-text-2">{sr.notifications.empty}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${
                  item.readAt ? "bg-transparent" : "bg-accent"
                }`}
                aria-label={
                  item.readAt
                    ? sr.notifications.read
                    : sr.notifications.unread
                }
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text">{item.title}</p>
                <p className="mt-1 text-sm text-text-2">{item.message}</p>
                <time
                  className="mt-2 block text-xs text-muted"
                  dateTime={item.createdAt}
                >
                  {formatCreatedAt(item.createdAt)}
                </time>
              </div>
              {!item.readAt ? (
                <PrimaryButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={updating === item.id}
                  disabled={updating !== null && updating !== item.id}
                  leftIcon={<Check aria-hidden="true" />}
                  aria-label={sr.notifications.markRead}
                  onClick={() => void markRead(item.id)}
                >
                  {sr.notifications.markRead}
                </PrimaryButton>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

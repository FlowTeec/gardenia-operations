export const instant = false;
import type { Metadata } from "next";
import { requireActor } from "@/lib/gardenia/auth";
import { readWorkspace } from "@/lib/gardenia/store";
import { NotificationsClient } from "@/components/gardenia/notifications-client";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const actor = await requireActor();
  const ws = await readWorkspace();

  const myNotifications = ws.notifications
    .filter((n) => n.userId === actor.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <NotificationsClient notifications={myNotifications} />
    </div>
  );
}

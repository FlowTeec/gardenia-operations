"use client";

import { useTransition } from "react";
import { Bell, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/gardenia/actions";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
  relatedType: "sales" | "replenishment" | "inventory" | null;
}

const iconMap = {
  info: <Info className="w-4 h-4 text-blue-500" />,
  success: <CheckCircle className="w-4 h-4 text-green-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  error: <XCircle className="w-4 h-4 text-red-500" />,
};

const bgMap = {
  info: "bg-blue-50 border-blue-100",
  success: "bg-green-50 border-green-100",
  warning: "bg-orange-50 border-orange-100",
  error: "bg-red-50 border-red-100",
};

export function NotificationsClient({ notifications }: { notifications: Notification[] }) {
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleMarkRead(id: string) {
    startTransition(async () => { await markNotificationRead(id); });
  }

  function handleMarkAll() {
    startTransition(async () => { await markAllNotificationsRead(); });
  }

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={isPending}
            className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900">No notifications</h3>
          <p className="text-gray-500 text-sm mt-1">You will be notified of important events here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`relative rounded-xl border p-4 transition-colors ${
                n.read ? "bg-white border-gray-200" : bgMap[n.type]
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{iconMap[n.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${n.read ? "text-gray-700" : "text-gray-900"}`}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-400">
                        {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          disabled={isPending}
                          className="w-4 h-4 rounded-full bg-green-500 hover:bg-green-600 flex-shrink-0"
                          title="Mark as read"
                        />
                      )}
                    </div>
                  </div>
                  <p className={`text-sm mt-0.5 ${n.read ? "text-gray-500" : "text-gray-700"}`}>
                    {n.message}
                  </p>
                  {n.relatedType && (
                    <span className="text-[10px] text-gray-400 mt-1 capitalize">{n.relatedType}</span>
                  )}
                </div>
              </div>
              {!n.read && (
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-500" />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

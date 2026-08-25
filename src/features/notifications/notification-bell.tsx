"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { markAllNotificationsRead, markNotificationRead } from "./actions";

export type Notification = {
  id: string;
  notification_type: "invitation" | "task_assigned" | "comment" | "deadline";
  title: string;
  body: string | null;
  link_path: string;
  read_at: string | null;
  created_at: string;
};

function relativeTime(
  isoDate: string,
  t: ReturnType<typeof useTranslations<"notifications">>,
) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return t("timeNow");
  if (diffMinutes < 60) return t("timeMinutes", { count: diffMinutes });
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return t("timeHours", { count: diffHours });
  const diffDays = Math.round(diffHours / 24);
  return t("timeDays", { count: diffDays });
}

export function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const t = useTranslations("notifications");
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="icon" className="relative" />}
      >
        <BellIcon className="size-4" />
        <span className="sr-only">
          {t("title")} {unreadCount ? t("unreadSuffix", { count: unreadCount }) : ""}
        </span>
        {unreadCount ? (
          <Badge
            variant="destructive"
            className="absolute -top-1.5 -right-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1">
          <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">{t("title")}</p>
          {unreadCount ? (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => {
                void markAllNotificationsRead();
              }}
            >
              {t("markAllRead")}
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {notifications.length ? (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                render={<Link href={notification.link_path} />}
                className="flex-col items-start gap-0.5 whitespace-normal"
                onClick={() => {
                  if (!notification.read_at) {
                    void markNotificationRead(notification.id);
                  }
                }}
              >
                <span className="flex w-full items-center gap-2">
                  {!notification.read_at ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  ) : null}
                  <span className="font-medium">{notification.title}</span>
                </span>
                {notification.body ? (
                  <span className="text-xs text-muted-foreground">{notification.body}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">{relativeTime(notification.created_at, t)}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <p className="px-1.5 py-3 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

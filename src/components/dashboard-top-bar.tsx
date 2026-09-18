"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/language-switcher";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell, type Notification } from "@/features/notifications/notification-bell";

type DashboardTopBarProps = {
  isOrganizer: boolean;
  notifications: Notification[];
  signOutAction: () => void | Promise<void>;
};

export function DashboardTopBar({ isOrganizer, notifications, signOutAction }: DashboardTopBarProps) {
  const t = useTranslations("dashboard.topBar");

  return (
    <div className="flex items-center gap-3">
      {isOrganizer ? (
        <Link href="/organizer" className="text-sm font-semibold text-primary hover:text-primary/80">
          {t("organizerPanelLink")}
        </Link>
      ) : null}
      <LanguageSwitcher />
      <ThemeToggle />
      <NotificationBell notifications={notifications} />
      <form action={signOutAction}>
        <SubmitButton pendingLabel={t("signOutPending")} variant="outline">
          {t("signOut")}
        </SubmitButton>
      </form>
    </div>
  );
}

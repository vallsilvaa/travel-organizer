import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/features/auth/actions";
import { getAuthMessage } from "@/features/auth/messages";
import { type Notification } from "@/features/notifications/notification-bell";
import { DashboardTopBar } from "@/components/dashboard-top-bar";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DashboardPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");
  const generalError = await getAuthMessage(params.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const [{ data: profile }, { data: notifications }] = await Promise.all([
    supabase.from("profiles").select("display_name, is_organizer").eq("id", user.id).single(),
    supabase
      .from("notifications")
      .select("id, notification_type, title, body, link_path, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const displayName = profile?.display_name ?? user.email ?? tCommon("traveler");

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {tCommon("appName")}
            </p>
            <CardTitle className="mt-2 text-3xl">{t("welcome", { name: displayName })}</CardTitle>
            <CardDescription className="mt-2 text-base">
              {t("welcomeDescription")}
            </CardDescription>
            <CardAction>
              <DashboardTopBar
                isOrganizer={Boolean(profile?.is_organizer)}
                notifications={(notifications ?? []) as Notification[]}
                signOutAction={signOut}
              />
            </CardAction>
          </CardHeader>
          {generalError ? (
            <CardContent>
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {generalError}
              </p>
            </CardContent>
          ) : null}
        </Card>

        <div className="grid gap-6 sm:grid-cols-2">
          <Link href="/profile" className="block h-full">
            <Card className="h-full transition hover:border-sky-300 hover:bg-sky-50">
              <CardHeader>
                <CardTitle className="text-2xl">{t("hub.profile.title")}</CardTitle>
                <CardDescription>{t("hub.profile.description")}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/trips" className="block h-full">
            <Card className="h-full transition hover:border-sky-300 hover:bg-sky-50">
              <CardHeader>
                <CardTitle className="text-2xl">{t("hub.trips.title")}</CardTitle>
                <CardDescription>{t("hub.trips.description")}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}

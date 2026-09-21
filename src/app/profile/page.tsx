import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { changePassword, signOut, updateProfile } from "@/features/auth/actions";
import { getAuthMessage } from "@/features/auth/messages";
import { type Notification } from "@/features/notifications/notification-bell";
import { updateCollaborationEmailPreference } from "@/features/notifications/actions";
import { updateReminderPreference } from "@/features/reminders/actions";
import { PushToggle } from "@/features/push/push-toggle";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { DashboardTopBar } from "@/components/dashboard-top-bar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProfilePageProps = {
  searchParams: Promise<{
    error?: string;
    profileError?: string;
    profileMessage?: string;
    passwordError?: string;
    passwordMessage?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const t = await getTranslations("profile");
  const [generalError, profileError, profileMessage, passwordError, passwordMessage] = await Promise.all([
    getAuthMessage(params.error),
    getAuthMessage(params.profileError),
    getAuthMessage(params.profileMessage),
    getAuthMessage(params.passwordError),
    getAuthMessage(params.passwordMessage),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const [{ data: profile }, { data: notifications }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "first_name, last_name, birth_date, task_reminders_enabled, collaboration_emails_enabled, is_organizer",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("notifications")
      .select("id, notification_type, title, body, link_path, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 standalone:px-4 standalone:pt-3 standalone:pb-24">
      <div className="mx-auto max-w-3xl space-y-8">
        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <Link href="/dashboard" className="text-sm font-semibold text-primary hover:text-primary/80">
              {t("backToHub")}
            </Link>
            <CardTitle className="mt-2 text-3xl">{t("pageTitle")}</CardTitle>
            <CardAction className="standalone:sticky standalone:top-0 standalone:z-40 standalone:rounded-lg standalone:bg-card/95 standalone:px-2 standalone:py-1 standalone:backdrop-blur">
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

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-xl">{t("personalData.title")}</CardTitle>
            <CardDescription>{t("personalData.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {profileError ? (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {profileError}
              </p>
            ) : null}
            {profileMessage ? (
              <p className="mb-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
                {profileMessage}
              </p>
            ) : null}
            <form action={updateProfile} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t("personalData.firstNameLabel")}</Label>
                <Input
                  required
                  minLength={1}
                  maxLength={100}
                  id="firstName"
                  name="firstName"
                  defaultValue={profile?.first_name ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t("personalData.lastNameLabel")}</Label>
                <Input
                  maxLength={100}
                  id="lastName"
                  name="lastName"
                  defaultValue={profile?.last_name ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">{t("personalData.birthDateLabel")}</Label>
                <Input
                  type="date"
                  id="birthDate"
                  name="birthDate"
                  defaultValue={profile?.birth_date ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("personalData.emailLabel")}</Label>
                <p className="flex h-9 items-center text-sm text-slate-600">{user.email}</p>
              </div>
              <SubmitButton
                pendingLabel={t("personalData.savePending")}
                variant="outline"
                className="sm:col-span-2 sm:justify-self-start"
              >
                {t("personalData.save")}
              </SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-xl">{t("display.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-8">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("display.languageLabel")}</p>
              <LanguageSwitcher />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("display.themeLabel")}</p>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-xl">{t("reminders.title")}</CardTitle>
            <CardDescription>{t("reminders.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("reminders.emailSectionTitle")}</h3>
              <form
                action={updateReminderPreference}
                className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="taskRemindersEnabled"
                    defaultChecked={profile?.task_reminders_enabled ?? true}
                    className="h-5 w-5 rounded border-input accent-primary"
                  />
                  {t("reminders.checkboxLabel")}
                </label>
                <SubmitButton pendingLabel={t("reminders.savePending")} variant="outline">{t("reminders.save")}</SubmitButton>
              </form>
              <form
                action={updateCollaborationEmailPreference}
                className="mt-4 flex flex-col gap-4 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="collaborationEmailsEnabled"
                    defaultChecked={profile?.collaboration_emails_enabled ?? true}
                    className="h-5 w-5 rounded border-input accent-primary"
                  />
                  {t("reminders.collaborationCheckboxLabel")}
                </label>
                <SubmitButton pendingLabel={t("reminders.savePending")} variant="outline">{t("reminders.save")}</SubmitButton>
              </form>
            </section>
            <section className="border-t border-slate-200 pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("reminders.pushSectionTitle")}</h3>
              <div className="mt-3">
                <PushToggle />
              </div>
            </section>
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(8)]">
          <CardHeader>
            <CardTitle className="text-xl">{t("changePassword.title")}</CardTitle>
            <CardDescription>{t("changePassword.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {passwordError ? (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {passwordError}
              </p>
            ) : null}
            {passwordMessage ? (
              <p className="mb-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
                {passwordMessage}
              </p>
            ) : null}
            <form action={changePassword} className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="password">{t("changePassword.newPassword")}</Label>
                <Input required autoComplete="new-password" id="password" name="password" type="password" minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirmation">{t("changePassword.confirmPassword")}</Label>
                <Input required autoComplete="new-password" id="passwordConfirmation" name="passwordConfirmation" type="password" minLength={8} />
              </div>
              <SubmitButton pendingLabel={t("changePassword.savePending")} variant="outline" className="sm:col-span-2 sm:justify-self-start">
                {t("changePassword.save")}
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
      <AppBottomNav />
    </main>
  );
}

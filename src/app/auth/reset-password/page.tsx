import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { resetPassword } from "@/features/auth/actions";
import { getAuthMessage } from "@/features/auth/messages";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResetPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/forgot-password?error=reset_link_invalid");
  }

  const t = await getTranslations("auth.resetPassword");

  return (
    <AuthShell
      title={t("title")}
      description={t("description")}
      alternateText={t("alternateText")}
      alternateHref="/auth/sign-in"
      alternateLabel={t("alternateLabel")}
      error={await getAuthMessage(params.error)}
    >
      <form action={resetPassword} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            required
            autoComplete="new-password"
            id="password"
            name="password"
            type="password"
            minLength={8}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirmation">{t("passwordConfirmation")}</Label>
          <Input
            required
            autoComplete="new-password"
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            minLength={8}
          />
        </div>
        <SubmitButton pendingLabel={t("submitPending")} className="w-full" size="lg">
          {t("submit")}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}

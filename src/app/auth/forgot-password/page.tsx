import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { requestPasswordReset } from "@/features/auth/actions";
import { getAuthMessage } from "@/features/auth/messages";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const t = await getTranslations("auth.forgotPassword");

  return (
    <AuthShell
      title={t("title")}
      description={t("description")}
      alternateText={t("alternateText")}
      alternateHref="/auth/sign-in"
      alternateLabel={t("alternateLabel")}
      error={await getAuthMessage(params.error)}
      message={await getAuthMessage(params.message)}
    >
      <form action={requestPasswordReset} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input required autoComplete="email" id="email" name="email" type="email" />
        </div>
        <SubmitButton pendingLabel={t("submitPending")} className="w-full" size="lg">
          {t("submit")}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}

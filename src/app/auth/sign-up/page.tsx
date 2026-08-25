import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { signUp } from "@/features/auth/actions";
import { getAuthMessage } from "@/features/auth/messages";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignUpPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const t = await getTranslations("auth.signUp");

  return (
    <AuthShell
      title={t("title")}
      description={t("description")}
      alternateText={t("alternateText")}
      alternateHref="/auth/sign-in"
      alternateLabel={t("alternateLabel")}
      error={await getAuthMessage(params.error)}
    >
      <form action={signUp} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="displayName">{t("name")}</Label>
          <Input required autoComplete="name" minLength={2} id="displayName" name="displayName" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input required autoComplete="email" id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            required
            autoComplete="new-password"
            minLength={8}
            id="password"
            name="password"
            type="password"
          />
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirmation">{t("passwordConfirmation")}</Label>
          <Input
            required
            autoComplete="new-password"
            minLength={8}
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
          />
        </div>
        <SubmitButton pendingLabel={t("submitPending")} className="w-full" size="lg">
          {t("submit")}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}

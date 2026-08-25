import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { signIn } from "@/features/auth/actions";
import { getAuthMessage } from "@/features/auth/messages";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignInPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const t = await getTranslations("auth.signIn");

  return (
    <AuthShell
      title={t("title")}
      description={t("description")}
      alternateText={t("alternateText")}
      alternateHref="/auth/sign-up"
      alternateLabel={t("alternateLabel")}
      error={await getAuthMessage(params.error)}
      message={await getAuthMessage(params.message)}
    >
      <form action={signIn} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input required autoComplete="email" id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("password")}</Label>
            <Link
              href="/auth/forgot-password"
              className="text-sm font-semibold text-sky-700 hover:text-sky-800"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            required
            autoComplete="current-password"
            id="password"
            name="password"
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

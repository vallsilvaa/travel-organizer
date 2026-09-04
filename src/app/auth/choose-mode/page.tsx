import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ChooseModePage() {
  const t = await getTranslations("auth.chooseMode");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in?error=authentication_required");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_traveler, is_organizer")
    .eq("id", user.id)
    .maybeSingle();

  // This page only makes sense for dual-role accounts; anyone else who
  // lands here directly gets sent straight to their one available mode.
  if (!(profile?.is_traveler && profile?.is_organizer)) {
    redirect(profile?.is_organizer ? "/organizer" : "/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <Card className="w-full max-w-md [--card-spacing:--spacing(8)]">
        <CardHeader>
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Link href="/organizer" className={`${buttonVariants({ size: "lg" })} flex-1 justify-center`}>
            {t("organizerView")}
          </Link>
          <Link
            href="/dashboard"
            className={`${buttonVariants({ variant: "outline", size: "lg" })} flex-1 justify-center`}
          >
            {t("travelerView")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

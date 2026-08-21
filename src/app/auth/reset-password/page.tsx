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

  return (
    <AuthShell
      title="Defina uma nova senha"
      description="Escolha uma nova senha para sua conta."
      alternateText="Mudou de ideia?"
      alternateHref="/auth/sign-in"
      alternateLabel="Voltar para entrar"
      error={getAuthMessage(params.error)}
    >
      <form action={resetPassword} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
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
          <Label htmlFor="passwordConfirmation">Confirmar nova senha</Label>
          <Input
            required
            autoComplete="new-password"
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            minLength={8}
          />
        </div>
        <SubmitButton pendingLabel="Salvando..." className="w-full" size="lg">
          Salvar nova senha
        </SubmitButton>
      </form>
    </AuthShell>
  );
}

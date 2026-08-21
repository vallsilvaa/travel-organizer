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

  return (
    <AuthShell
      title="Esqueceu sua senha?"
      description="Informe seu e-mail e, se houver uma conta associada a ele, enviaremos um link para redefinir sua senha."
      alternateText="Lembrou a senha?"
      alternateHref="/auth/sign-in"
      alternateLabel="Voltar para entrar"
      error={getAuthMessage(params.error)}
      message={getAuthMessage(params.message)}
    >
      <form action={requestPasswordReset} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input required autoComplete="email" id="email" name="email" type="email" />
        </div>
        <SubmitButton pendingLabel="Enviando..." className="w-full" size="lg">
          Enviar link de redefinição
        </SubmitButton>
      </form>
    </AuthShell>
  );
}

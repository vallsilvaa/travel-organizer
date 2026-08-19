import { AuthShell } from "@/components/auth/auth-shell";
import { signUp } from "@/features/auth/actions";
import { getAuthMessage } from "@/features/auth/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignUpPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Crie sua conta"
      description="Suas viagens, tarefas, comentários e despesas permanecem privados para os participantes convidados."
      alternateText="Já tem uma conta?"
      alternateHref="/auth/sign-in"
      alternateLabel="Entrar"
      error={getAuthMessage(params.error)}
    >
      <form action={signUp} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="displayName">Nome</Label>
          <Input required autoComplete="name" minLength={2} id="displayName" name="displayName" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input required autoComplete="email" id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            required
            autoComplete="new-password"
            minLength={8}
            id="password"
            name="password"
            type="password"
          />
          <p className="text-xs text-muted-foreground">Pelo menos oito caracteres.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirmation">Confirmar senha</Label>
          <Input
            required
            autoComplete="new-password"
            minLength={8}
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
          />
        </div>
        <Button type="submit" className="w-full" size="lg">
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}

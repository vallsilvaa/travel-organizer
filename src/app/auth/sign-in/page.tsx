import { AuthShell } from "@/components/auth/auth-shell";
import { signIn } from "@/features/auth/actions";
import { getAuthMessage } from "@/features/auth/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignInPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Bem-vindo de volta"
      description="Entre para acessar suas viagens privadas e seu espaço de planejamento."
      alternateText="Novo no Travel Organizer?"
      alternateHref="/auth/sign-up"
      alternateLabel="Criar uma conta"
      error={getAuthMessage(params.error)}
      message={getAuthMessage(params.message)}
    >
      <form action={signIn} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input required autoComplete="email" id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            required
            autoComplete="current-password"
            id="password"
            name="password"
            type="password"
          />
        </div>
        <Button type="submit" className="w-full" size="lg">
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}

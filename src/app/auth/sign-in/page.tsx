import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn } from "@/features/auth/actions";
import { getAuthMessage } from "@/features/auth/messages";

type SignInPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to access your private trips and planning workspace."
      alternateText="New to Travel Organizer?"
      alternateHref="/auth/sign-up"
      alternateLabel="Create an account"
      error={getAuthMessage(params.error)}
      message={getAuthMessage(params.message)}
    >
      <form action={signIn}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              required
              autoComplete="email"
              id="email"
              name="email"
              type="email"
              className="h-11"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              required
              autoComplete="current-password"
              id="password"
              name="password"
              type="password"
              className="h-11"
            />
          </Field>
          <Button size="lg" className="h-11 w-full text-base font-semibold">
            Sign in
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}

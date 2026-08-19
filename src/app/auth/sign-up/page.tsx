import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signUp } from "@/features/auth/actions";
import { getAuthMessage } from "@/features/auth/messages";

type SignUpPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Create your account"
      description="Your trips, tasks, comments, and expenses stay private to invited participants."
      alternateText="Already have an account?"
      alternateHref="/auth/sign-in"
      alternateLabel="Sign in"
      error={getAuthMessage(params.error)}
    >
      <form action={signUp}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="displayName">Name</FieldLabel>
            <Input
              required
              autoComplete="name"
              id="displayName"
              minLength={2}
              name="displayName"
              className="h-11"
            />
          </Field>
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
              autoComplete="new-password"
              id="password"
              minLength={8}
              name="password"
              type="password"
              className="h-11"
            />
            <FieldDescription>At least eight characters.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="passwordConfirmation">
              Confirm password
            </FieldLabel>
            <Input
              required
              autoComplete="new-password"
              id="passwordConfirmation"
              minLength={8}
              name="passwordConfirmation"
              type="password"
              className="h-11"
            />
          </Field>
          <Button size="lg" className="h-11 w-full text-base font-semibold">
            Create account
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}

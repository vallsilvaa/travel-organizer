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
      title="Create your account"
      description="Your trips, tasks, comments, and expenses stay private to invited participants."
      alternateText="Already have an account?"
      alternateHref="/auth/sign-in"
      alternateLabel="Sign in"
      error={getAuthMessage(params.error)}
    >
      <form action={signUp} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="displayName">Name</Label>
          <Input required autoComplete="name" minLength={2} id="displayName" name="displayName" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input required autoComplete="email" id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            required
            autoComplete="new-password"
            minLength={8}
            id="password"
            name="password"
            type="password"
          />
          <p className="text-xs text-muted-foreground">At least eight characters.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirmation">Confirm password</Label>
          <Input
            required
            autoComplete="new-password"
            minLength={8}
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
          />
        </div>
        <Button className="w-full" size="lg">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}

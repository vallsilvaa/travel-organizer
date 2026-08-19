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
      title="Welcome back"
      description="Sign in to access your private trips and planning workspace."
      alternateText="New to Travel Organizer?"
      alternateHref="/auth/sign-up"
      alternateLabel="Create an account"
      error={getAuthMessage(params.error)}
      message={getAuthMessage(params.message)}
    >
      <form action={signIn} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input required autoComplete="email" id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            required
            autoComplete="current-password"
            id="password"
            name="password"
            type="password"
          />
        </div>
        <Button className="w-full" size="lg">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

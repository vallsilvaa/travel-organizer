import { AuthShell } from "@/components/auth/auth-shell";
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
      <form action={signIn} className="space-y-5">
        <label className="block text-sm font-medium text-slate-800">
          Email
          <input
            required
            autoComplete="email"
            name="email"
            type="email"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Password
          <input
            required
            autoComplete="current-password"
            name="password"
            type="password"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <button className="w-full rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800">
          Sign in
        </button>
      </form>
    </AuthShell>
  );
}

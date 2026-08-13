import { AuthShell } from "@/components/auth/auth-shell";
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
      <form action={signUp} className="space-y-5">
        <label className="block text-sm font-medium text-slate-800">
          Name
          <input
            required
            autoComplete="name"
            minLength={2}
            name="displayName"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          />
        </label>
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
            autoComplete="new-password"
            minLength={8}
            name="password"
            type="password"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          />
          <span className="mt-1 block text-xs text-slate-500">At least eight characters.</span>
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Confirm password
          <input
            required
            autoComplete="new-password"
            minLength={8}
            name="passwordConfirmation"
            type="password"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <button className="w-full rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800">
          Create account
        </button>
      </form>
    </AuthShell>
  );
}

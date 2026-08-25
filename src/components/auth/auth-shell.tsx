import Link from "next/link";
import type { ReactNode } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

type AuthShellProps = {
  title: string;
  description: string;
  alternateText: string;
  alternateHref: string;
  alternateLabel: string;
  error?: string | null;
  message?: string | null;
  children: ReactNode;
};

// Deliberately not async/translated: nested async Server Components can't
// be rendered by @testing-library/react's render() (only the directly
// awaited top-level page can be), and "Travel Organizer" is a brand name -
// identical in every locale in messages/{pt,en}.json anyway.
export function AuthShell({
  title,
  description,
  alternateText,
  alternateHref,
  alternateLabel,
  error,
  message,
  children,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700"
          >
            Travel Organizer
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

        {error ? (
          <p role="alert" className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-6 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
            {message}
          </p>
        ) : null}

        <div className="mt-6">{children}</div>
        <p className="mt-6 text-center text-sm text-slate-600">
          {alternateText}{" "}
          <Link className="font-semibold text-sky-700 hover:text-sky-800" href={alternateHref}>
            {alternateLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}

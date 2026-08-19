import { CompassIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(70%_70%_at_50%_0%,var(--accent),transparent_70%)]"
      />

      <header className="relative">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CompassIcon className="size-4" />
            </span>
            Travel Organizer
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
            <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-pretty text-muted-foreground">
              {description}
            </p>

            {error ? (
              <Alert
                variant="destructive"
                className="mt-6 border-destructive/20 bg-destructive-muted"
              >
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {message ? (
              <Alert className="mt-6 border-primary/20 bg-accent">
                <AlertDescription className="text-accent-foreground">
                  {message}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="mt-6">{children}</div>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {alternateText}{" "}
            <Link
              className="font-semibold text-primary hover:underline"
              href={alternateHref}
            >
              {alternateLabel}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

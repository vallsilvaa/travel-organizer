import {
  CalendarDaysIcon,
  CompassIcon,
  MessagesSquareIcon,
  ReceiptTextIcon,
  SquareCheckBigIcon,
} from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

const features = [
  {
    description: "Activities and reservations in chronological order.",
    icon: CalendarDaysIcon,
    title: "Itinerary",
  },
  {
    description: "Owners, deadlines, and a readiness score before departure.",
    icon: SquareCheckBigIcon,
    title: "Tasks",
  },
  {
    description: "Shared costs totalled separately per currency.",
    icon: ReceiptTextIcon,
    title: "Expenses",
  },
  {
    description: "Comments on any itinerary item or task.",
    icon: MessagesSquareIcon,
    title: "Collaboration",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
          <span className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CompassIcon className="size-4" />
            </span>
            Travel Organizer
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm" variant="ghost">
              <Link href="/auth/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/sign-up">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-125 bg-[radial-gradient(60%_60%_at_50%_50%,var(--accent),transparent_70%)]"
          />
          <div className="relative mx-auto max-w-3xl px-6 pt-20 pb-16 text-center sm:pt-28">
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
              Trip planning, together
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-6xl">
              Everything for your next trip, organized in one place.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-pretty text-muted-foreground">
              Plan itineraries, coordinate tasks, collaborate, and track
              expenses with your travel organizer.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-11 px-6 text-base font-semibold">
                <Link href="/auth/sign-up">Create account</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 px-6 text-base font-semibold"
              >
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <li
                key={feature.title}
                className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="size-4.5" />
                </span>
                <h2 className="mt-4 font-semibold text-foreground">
                  {feature.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
          Your trips, tasks, comments, and expenses stay private to invited
          participants.
        </div>
      </footer>
    </div>
  );
}

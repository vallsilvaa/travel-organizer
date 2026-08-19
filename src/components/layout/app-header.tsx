import { CompassIcon } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part[0]).join("");
  return (letters || name[0] || "T").toUpperCase();
}

export function AppHeader({ displayName }: { displayName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CompassIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">Travel Organizer</span>
        </Link>

        <nav className="ml-2 flex items-center">
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard">Trips</Link>
          </Button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {displayName}
          </span>
          <Avatar size="sm">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
          <form action={signOut}>
            <Button size="sm" type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

"use client";

import { HomeIcon, MapIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ComponentType } from "react";

import { cn } from "@/lib/utils";
import { useStandalone } from "@/lib/use-standalone";

const items: { href: string; icon: ComponentType<{ className?: string }>; labelKey: "home" | "trips" | "profile" }[] = [
  { href: "/dashboard", icon: HomeIcon, labelKey: "home" },
  { href: "/trips", icon: MapIcon, labelKey: "trips" },
  { href: "/profile", icon: UserIcon, labelKey: "profile" },
];

// Only meant to be rendered on the 3 root destinations it links to - never
// mounted outside standalone (home-screen) mode, so it never shows up in the
// regular browser/responsive experience (and doesn't collide with those
// pages' own links when queried by accessible name in tests).
export function AppBottomNav() {
  const t = useTranslations("common.nav");
  const pathname = usePathname();
  const standalone = useStandalone();

  if (!standalone) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-slate-200 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <ul className="flex w-full items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {items.map(({ href, icon: Icon, labelKey }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-xs font-medium text-slate-500",
                  active && "text-primary",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" />
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

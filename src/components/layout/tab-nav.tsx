import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type TabItem = {
  count?: number;
  href: string;
  icon: LucideIcon;
  key: string;
  label: string;
};

/* Links, not client state: keeps each panel a server component and deep-linkable. */
export function TabNav({
  activeKey,
  items,
}: {
  activeKey: string;
  items: TabItem[];
}) {
  return (
    <nav className="-mx-6 overflow-x-auto px-6">
      <ul className="flex min-w-max items-center gap-1 border-b border-border">
        {items.map((item) => {
          const active = item.key === activeKey;
          const Icon = item.icon;

          return (
            <li key={item.key}>
              <Link
                aria-current={active ? "page" : undefined}
                href={item.href}
                scroll={false}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
                {item.count !== undefined ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

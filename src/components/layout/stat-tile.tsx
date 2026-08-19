import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const tones = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
} as const;

type StatTileProps = {
  hint?: string;
  icon: LucideIcon;
  label: string;
  tone?: keyof typeof tones;
  value: string;
};

export function StatTile({
  hint,
  icon: Icon,
  label,
  tone = "default",
  value,
}: StatTileProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium tracking-wide uppercase">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          tones[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

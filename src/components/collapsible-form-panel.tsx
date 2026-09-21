"use client";

import { PlusIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStandalone } from "@/lib/use-standalone";

type CollapsibleFormPanelProps = {
  /** Text shown on the <summary> (browser) and as the sheet's title/trigger label (standalone). */
  trigger: ReactNode;
  /** "fab" for page-level "add new item" panels, "inline" for per-item or settings-style edit panels. */
  variant?: "fab" | "inline";
  /** Only honored in the <details> (browser) rendering. */
  defaultOpen?: boolean;
  /** className for the <details> wrapper (browser mode). */
  detailsClassName?: string;
  /** className for the <summary> (browser mode). */
  summaryClassName?: string;
  /** className for the inline trigger button (standalone + variant="inline"). */
  triggerClassName?: string;
  children: ReactNode;
};

// Renders the app's long-standing "expand to reveal a form" pattern as a
// plain <details>/<summary> in the browser (identical to what every trip page
// section already did), but as a FAB or inline button opening a bottom-sheet
// Dialog when running installed from the home screen - see the standalone
// plan for why the two need genuinely different DOM shapes, not just CSS.
export function CollapsibleFormPanel({
  trigger,
  variant = "fab",
  defaultOpen,
  detailsClassName,
  summaryClassName,
  triggerClassName,
  children,
}: CollapsibleFormPanelProps) {
  const standalone = useStandalone();
  const [open, setOpen] = useState(false);

  if (standalone) {
    return (
      <>
        {variant === "fab" ? (
          <Button
            type="button"
            size="icon"
            className="fixed right-4 bottom-20 z-40 size-14 rounded-full shadow-lg"
            onClick={() => setOpen(true)}
          >
            <PlusIcon className="size-6" />
            <span className="sr-only">{trigger}</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className={cn("h-auto p-0 font-semibold text-sky-700 hover:text-sky-800", triggerClassName)}
            onClick={() => setOpen(true)}
          >
            {trigger}
          </Button>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{trigger}</DialogTitle>
            </DialogHeader>
            {children}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <details className={detailsClassName} open={defaultOpen}>
      <summary className={cn("cursor-pointer font-semibold text-slate-900", summaryClassName)}>
        {trigger}
      </summary>
      {children}
    </details>
  );
}

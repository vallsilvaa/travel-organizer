"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { TemplateForm } from "./template-form";

type NewTaskModalProps = {
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
  tripId?: string;
};

export function NewTaskModal({ triggerLabel, triggerVariant, triggerSize = "lg", tripId }: NewTaskModalProps) {
  const t = useTranslations("templateForm");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel ?? t("newTaskTrigger")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("newTaskTitle")}</DialogTitle>
          <DialogDescription>{t("newTaskDescription")}</DialogDescription>
        </DialogHeader>
        <TemplateForm
          tripId={tripId}
          onSuccess={() => setOpen(false)}
          cancelSlot={
            <DialogClose render={<Button type="button" variant="outline" size="lg" />}>
              {t("cancel")}
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  );
}

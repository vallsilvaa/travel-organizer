"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ConfirmDeleteFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  title: string;
  description: string;
  triggerLabel?: string;
  triggerClassName?: string;
};

export function ConfirmDeleteForm({
  action,
  hiddenFields,
  title,
  description,
  triggerLabel,
  triggerClassName = "h-auto p-0 text-destructive",
}: ConfirmDeleteFormProps) {
  const t = useTranslations("confirmDeleteForm");
  const resolvedTriggerLabel = triggerLabel ?? t("deleteDefault");
  const formId = useId();
  const [open, setOpen] = useState(false);

  return (
    <form id={formId} action={action}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={<Button type="button" variant="link" className={triggerClassName} />}
        >
          {resolvedTriggerLabel}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton
              pendingLabel={t("deletingPending")}
              form={formId}
              variant="destructive"
            >
              {resolvedTriggerLabel}
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

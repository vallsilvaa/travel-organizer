"use client";

import { EllipsisIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ItemActionsMenuProps = {
  editForm: ReactNode;
  editLabel?: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
  deleteHiddenFields: Record<string, string>;
  deleteTitle: string;
  deleteDescription: string;
  deleteLabel?: string;
};

export function ItemActionsMenu({
  editForm,
  editLabel,
  deleteAction,
  deleteHiddenFields,
  deleteTitle,
  deleteDescription,
  deleteLabel,
}: ItemActionsMenuProps) {
  const t = useTranslations("itemActionsMenu");
  const resolvedEditLabel = editLabel ?? t("editDefault");
  const resolvedDeleteLabel = deleteLabel ?? t("deleteDefault");
  const formId = useId();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="ghost" size="icon-sm" />}
        >
          <EllipsisIcon className="size-4" />
          <span className="sr-only">{t("actionsLabel")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen((open) => !open)}>
            {editOpen ? t("hideForm") : resolvedEditLabel}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            {resolvedDeleteLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen ? <div className="mt-4 border-t pt-4">{editForm}</div> : null}

      <form id={formId} action={deleteAction} className="hidden">
        {Object.entries(deleteHiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </form>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteTitle}</DialogTitle>
            <DialogDescription>{deleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" form={formId} variant="destructive">
              {resolvedDeleteLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

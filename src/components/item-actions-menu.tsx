"use client";

import { EllipsisIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
import { useStandalone } from "@/lib/use-standalone";

type ItemActionsMenuProps = {
  editForm: ReactNode;
  editLabel?: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
  deleteHiddenFields: Record<string, string>;
  deleteTitle: string;
  deleteDescription: string;
  deleteLabel?: string;
  // Opt-in (R07): a read-only "Ver" action, rendered inline like the edit
  // panel below. Omitted by every caller except the itinerary card today, so
  // the other tabs' menus keep their exact current Editar/Excluir shape.
  viewLabel?: string;
  viewContent?: ReactNode;
  // Opt-in (R07): pass a value that changes once a save actually lands (e.g.
  // the item's updated_at, which only moves after updateItineraryItem's
  // revalidatePath re-renders this card with fresh data) to auto-collapse
  // the edit/view panels instead of requiring the manual "Ocultar formulário"
  // click every other caller still needs. undefined = today's behavior.
  collapseOnChangeOf?: string;
  // Opt-in (R06/D8): a "Marcar como revisado" shortcut, submitted the same
  // way deleteAction is (a hidden form + its own hidden fields) but without
  // a confirmation dialog - it only ever flips needs_review, nothing the
  // visitor needs to confirm. Omitted by every caller except the itinerary
  // card, and only passed there when the item actually needs review, so
  // every other tab's menu keeps its exact current shape.
  markAsReviewedLabel?: string;
  markAsReviewedAction?: (formData: FormData) => void | Promise<void>;
  markAsReviewedHiddenFields?: Record<string, string>;
};

export function ItemActionsMenu({
  editForm,
  editLabel,
  deleteAction,
  deleteHiddenFields,
  deleteTitle,
  deleteDescription,
  deleteLabel,
  viewLabel,
  viewContent,
  collapseOnChangeOf,
  markAsReviewedLabel,
  markAsReviewedAction,
  markAsReviewedHiddenFields,
}: ItemActionsMenuProps) {
  const t = useTranslations("itemActionsMenu");
  const resolvedEditLabel = editLabel ?? t("editDefault");
  const resolvedViewLabel = viewLabel ?? t("viewDefault");
  const resolvedDeleteLabel = deleteLabel ?? t("deleteDefault");
  const resolvedMarkAsReviewedLabel = markAsReviewedLabel ?? t("markAsReviewedDefault");
  const formId = useId();
  const markReviewedFormRef = useRef<HTMLFormElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const standalone = useStandalone();
  const collapseTrackerRef = useRef(collapseOnChangeOf);

  useEffect(() => {
    if (collapseOnChangeOf === undefined || collapseTrackerRef.current === collapseOnChangeOf) {
      return;
    }
    collapseTrackerRef.current = collapseOnChangeOf;
    setEditOpen(false);
    setViewOpen(false);
  }, [collapseOnChangeOf]);

  function toggleView() {
    setEditOpen(false);
    setViewOpen((open) => !open);
  }

  function toggleEdit() {
    setViewOpen(false);
    setEditOpen((open) => (standalone ? true : !open));
  }

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
          {viewContent ? (
            <DropdownMenuItem onClick={toggleView}>
              {viewOpen ? t("hideView") : resolvedViewLabel}
            </DropdownMenuItem>
          ) : null}
          {markAsReviewedAction ? (
            <DropdownMenuItem onClick={() => markReviewedFormRef.current?.requestSubmit()}>
              {resolvedMarkAsReviewedLabel}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={toggleEdit}>
            {!standalone && editOpen ? t("hideForm") : resolvedEditLabel}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            {resolvedDeleteLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {viewContent && viewOpen ? <div className="mt-4 border-t pt-4">{viewContent}</div> : null}

      {!standalone && editOpen ? <div className="mt-4 border-t pt-4">{editForm}</div> : null}

      {standalone ? (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{resolvedEditLabel}</DialogTitle>
            </DialogHeader>
            {editForm}
          </DialogContent>
        </Dialog>
      ) : null}

      <form id={formId} action={deleteAction} className="hidden">
        {Object.entries(deleteHiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </form>
      {markAsReviewedAction ? (
        <form ref={markReviewedFormRef} action={markAsReviewedAction} className="hidden">
          {Object.entries(markAsReviewedHiddenFields ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
      ) : null}
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

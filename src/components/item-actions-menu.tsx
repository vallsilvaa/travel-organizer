"use client";

import { EllipsisIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

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
  editLabel = "Editar",
  deleteAction,
  deleteHiddenFields,
  deleteTitle,
  deleteDescription,
  deleteLabel = "Excluir",
}: ItemActionsMenuProps) {
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
          <span className="sr-only">Ações do item</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen((open) => !open)}>
            {editOpen ? "Ocultar formulário" : editLabel}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            {deleteLabel}
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
              Cancelar
            </DialogClose>
            <Button type="submit" form={formId} variant="destructive">
              {deleteLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

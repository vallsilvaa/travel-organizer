"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { pdfFileName } from "@/features/itinerary/pdf-filename";

type ItineraryExportMenuProps = {
  tripId: string;
  tripTitle: string;
};

export function ItineraryExportMenu({ tripId, tripTitle }: ItineraryExportMenuProps) {
  const t = useTranslations("itineraryExportMenu");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileName = pdfFileName(tripTitle);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
          {t("trigger")}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setConfirmOpen(true)}>{t("pdfOption")}</DropdownMenuItem>
          <DropdownMenuLinkItem href={`/api/trips/${tripId}/itinerary.ics`} download closeOnClick>
            {t("icsOption")}
          </DropdownMenuLinkItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmTitle", { fileName })}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
            <Button
              type="button"
              render={<a href={`/api/trips/${tripId}/itinerary.pdf`} download />}
              onClick={() => setConfirmOpen(false)}
            >
              {t("confirmDownload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

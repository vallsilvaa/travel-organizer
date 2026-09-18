"use client";

import { useState } from "react";
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

import { TripForm } from "./trip-form";

export function TravelerNewTripModal() {
  const t = useTranslations("trips.createTrip");
  const tEditForm = useTranslations("trip.editForm");
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="lg" />}>{t("triggerLabel")}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <TripForm
          cancelSlot={
            <DialogClose render={<Button type="button" variant="outline" size="lg" />}>
              {tEditForm("cancel")}
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  );
}

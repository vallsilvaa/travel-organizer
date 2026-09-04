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

import { OrganizerTripExtras } from "./organizer-trip-extras";
import { TripForm } from "./trip-form";

type CatalogTemplate = {
  id: string;
  title: string;
  category: string;
  country: string;
  city: string | null;
};

type NewTripModalProps = {
  templates: CatalogTemplate[];
};

export function NewTripModal({ templates }: NewTripModalProps) {
  const t = useTranslations("organizerPanel.createTrip");
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
          onSuccess={() => setOpen(false)}
          extraFields={<OrganizerTripExtras templates={templates} />}
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

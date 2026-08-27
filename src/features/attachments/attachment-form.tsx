"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { uploadAttachment, type AttachmentActionState } from "./actions";

type AssociableItem = { id: string; title: string };

type AttachmentFormProps = {
  tripId: string;
  itineraryItems: AssociableItem[];
  tasks: AssociableItem[];
  reservations: AssociableItem[];
};

const initialState: AttachmentActionState = {};

export function AttachmentForm({ tripId, itineraryItems, tasks, reservations }: AttachmentFormProps) {
  const t = useTranslations("attachmentForm");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(uploadAttachment, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success(t("toastUploaded"));
      formRef.current?.reset();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, t]);

  const hasAssociableItems = itineraryItems.length || tasks.length || reservations.length;

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="attachment-file">{t("fileLabel")}</Label>
        <Input
          required
          id="attachment-file"
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/jpeg,image/png,image/webp,image/heic"
        />
        <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
      </div>

      {hasAssociableItems ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="attachment-association">
            {t("associateLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
          </Label>
          <Select
            defaultValue="none"
            items={{
              none: t("associateNone"),
              ...Object.fromEntries(itineraryItems.map((item) => [`itinerary:${item.id}`, `${t("itineraryPrefix")} · ${item.title}`])),
              ...Object.fromEntries(tasks.map((task) => [`task:${task.id}`, `${t("taskPrefix")} · ${task.title}`])),
              ...Object.fromEntries(reservations.map((reservation) => [`reservation:${reservation.id}`, `${t("reservationPrefix")} · ${reservation.title}`])),
            }}
            onValueChange={(value) => {
              const form = formRef.current;
              if (!form) return;
              const [itemType, itemId] = !value || value === "none" ? ["", ""] : value.split(":");
              (form.elements.namedItem("itemType") as HTMLInputElement).value = itemType;
              (form.elements.namedItem("itemId") as HTMLInputElement).value = itemId;
            }}
          >
            <SelectTrigger id="attachment-association" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("associateNone")}</SelectItem>
              {itineraryItems.map((item) => (
                <SelectItem key={item.id} value={`itinerary:${item.id}`}>{t("itineraryPrefix")} · {item.title}</SelectItem>
              ))}
              {tasks.map((task) => (
                <SelectItem key={task.id} value={`task:${task.id}`}>{t("taskPrefix")} · {task.title}</SelectItem>
              ))}
              {reservations.map((reservation) => (
                <SelectItem key={reservation.id} value={`reservation:${reservation.id}`}>{t("reservationPrefix")} · {reservation.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="itemType" defaultValue="" />
          <input type="hidden" name="itemId" defaultValue="" />
        </div>
      ) : (
        <>
          <input type="hidden" name="itemType" value="" />
          <input type="hidden" name="itemId" value="" />
        </>
      )}

      <Button type="submit" disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? t("submitPending") : t("submit")}
      </Button>
    </form>
  );
}

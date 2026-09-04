"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { applyPrepTemplate, type ApplyTemplateActionState } from "./actions";

type Template = { id: string; title: string };
type Participant = { user_id: string; display_name: string; role: string };
type ItineraryItemOption = { id: string; title: string };

type ApplyTemplateFormProps = {
  itineraryItems: ItineraryItemOption[];
  participants: Participant[];
  templates: Template[];
  tripId: string;
};

const initialState: ApplyTemplateActionState = {};

export function ApplyTemplateForm({
  itineraryItems,
  participants,
  templates,
  tripId,
}: ApplyTemplateFormProps) {
  const t = useTranslations("organizerPanel.applyForm");
  const [state, formAction, pending] = useActionState(applyPrepTemplate, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(t("toastApplied"));
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, t]);

  if (!templates.length) {
    return <p className="text-sm text-muted-foreground">{t("noTemplates")}</p>;
  }

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="tripId" value={tripId} />

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="apply-templateId">
          {t("templateLabel")}
        </label>
        <Select
          required
          name="templateId"
          items={Object.fromEntries(templates.map((template) => [template.id, template.title]))}
        >
          <SelectTrigger id="apply-templateId" className="w-full">
            <SelectValue placeholder={t("templatePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="apply-assignedTo">
          {t("assignedToLabel")}
        </label>
        <Select
          name="assignedTo"
          defaultValue="none"
          items={{
            none: t("assignedToNone"),
            ...Object.fromEntries(participants.map((p) => [p.user_id, `${p.display_name} (${p.role})`])),
          }}
        >
          <SelectTrigger id="apply-assignedTo" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("assignedToNone")}</SelectItem>
            {participants.map((participant) => (
              <SelectItem key={participant.user_id} value={participant.user_id}>
                {participant.display_name} ({participant.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="apply-itineraryItemId">
          {t("itineraryLinkLabel")}
        </label>
        <Select
          name="itineraryItemId"
          defaultValue="none"
          items={{
            none: t("itineraryLinkNone"),
            ...Object.fromEntries(itineraryItems.map((item) => [item.id, item.title])),
          }}
        >
          <SelectTrigger id="apply-itineraryItemId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("itineraryLinkNone")}</SelectItem>
            {itineraryItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={pending} className="sm:col-span-3 sm:justify-self-start">
        {pending ? t("applyPending") : t("apply")}
      </Button>
    </form>
  );
}

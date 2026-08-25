"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { updateDestinationGuide, type UpdateDestinationGuideState } from "./actions";

const initialState: UpdateDestinationGuideState = {};

type DestinationGuideFormProps = {
  tripId: string;
  guide: {
    content: string | null;
    source: string | null;
    reviewedAt: string | null;
  };
};

export function DestinationGuideForm({ tripId, guide }: DestinationGuideFormProps) {
  const t = useTranslations("destinationGuideForm");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(updateDestinationGuide, initialState);

  useEffect(() => {
    if (state.success && state.message) {
      toast.success(state.message);
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="tripId" value={tripId} />
      <div className="space-y-2">
        <Label htmlFor="guide-content">{t("contentLabel")}</Label>
        <Textarea
          id="guide-content"
          name="content"
          rows={6}
          maxLength={5000}
          placeholder={t("contentPlaceholder")}
          defaultValue={guide.content ?? ""}
          aria-describedby={state.errors?.content ? "guide-content-error" : undefined}
        />
        {state.errors?.content ? (
          <p id="guide-content-error" className="text-sm text-destructive">{state.errors.content}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="guide-source">
            {t("sourceLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
          </Label>
          <Input
            id="guide-source"
            name="source"
            maxLength={300}
            placeholder={t("sourcePlaceholder")}
            defaultValue={guide.source ?? ""}
            aria-describedby={state.errors?.source ? "guide-source-error" : undefined}
          />
          {state.errors?.source ? (
            <p id="guide-source-error" className="text-sm text-destructive">{state.errors.source}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="guide-reviewed-at">
            {t("reviewedAtLabel")} <span className="font-normal text-muted-foreground">{tCommon("optional")}</span>
          </Label>
          <Input
            id="guide-reviewed-at"
            name="reviewedAt"
            type="date"
            defaultValue={guide.reviewedAt ?? ""}
            aria-describedby={state.errors?.reviewedAt ? "guide-reviewed-at-error" : undefined}
          />
          {state.errors?.reviewedAt ? (
            <p id="guide-reviewed-at-error" className="text-sm text-destructive">{state.errors.reviewedAt}</p>
          ) : null}
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? t("savePending") : t("save")}
      </Button>
    </form>
  );
}

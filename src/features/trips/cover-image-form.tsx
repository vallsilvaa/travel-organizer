"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

import { removeTripCoverImage, updateTripCoverImage, type CoverImageActionState } from "./actions";

type CoverImageFormProps = {
  tripId: string;
  hasCoverImage: boolean;
};

const initialState: CoverImageActionState = {};

export function CoverImageForm({ tripId, hasCoverImage }: CoverImageFormProps) {
  const t = useTranslations("coverImage");
  const [state, formAction, pending] = useActionState(updateTripCoverImage, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  // The file input (and its save/cancel actions) only shows up once the
  // visitor asks to add or change the cover - idle state just offers the
  // entry points, matching the trip overview's cover-management flow.
  const [isEditing, setIsEditing] = useState(false);

  // Closing the panel on a successful save is "adjusting state when a prop
  // changes" (react.dev's own pattern for this), done during render instead
  // of in an effect so it doesn't trigger an extra commit.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) {
      setIsEditing(false);
    }
  }

  useEffect(() => {
    if (state.success) {
      toast.success(state.message);
      formRef.current?.reset();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
          {hasCoverImage ? t("editCover") : t("addCover")}
        </Button>
        {hasCoverImage ? (
          <form action={removeTripCoverImage}>
            <input type="hidden" name="tripId" value={tripId} />
            <SubmitButton pendingLabel={t("submitPending")} variant="ghost">
              {t("removeCover")}
            </SubmitButton>
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="tripId" value={tripId} />
      <div className="space-y-2">
        <Label htmlFor="cover-image-file">{t("fileLabel")}</Label>
        <Input
          required
          id="cover-image-file"
          name="file"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.heic,image/jpeg,image/png,image/webp,image/heic"
        />
        <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
      </div>
      <Button type="submit" disabled={pending} variant="outline">
        {pending ? t("submitPending") : t("saveCover")}
      </Button>
      <Button type="button" variant="ghost" disabled={pending} onClick={() => setIsEditing(false)}>
        {t("cancel")}
      </Button>
    </form>
  );
}

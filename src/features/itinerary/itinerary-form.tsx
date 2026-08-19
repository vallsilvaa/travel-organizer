"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  createItineraryItem,
  updateItineraryItem,
  type ItineraryActionState,
} from "./actions";

type ItineraryFormProps = {
  item?: {
    id: string;
    item_date: string;
    start_time: string | null;
    title: string;
    location: string | null;
    notes: string | null;
  };
  tripId: string;
};

const initialState: ItineraryActionState = {};

export function ItineraryForm({ item, tripId }: ItineraryFormProps) {
  const action = item ? updateItineraryItem : createItineraryItem;
  const [state, formAction, pending] = useActionState(action, initialState);
  const fieldId = (name: string) => `itinerary-${item?.id ?? "new"}-${name}`;

  return (
    <form action={formAction}>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="tripId" value={tripId} />
        {item ? <input type="hidden" name="itemId" value={item.id} /> : null}

        <Field data-invalid={Boolean(state.errors?.date)}>
          <FieldLabel htmlFor={fieldId("date")}>Date</FieldLabel>
          <Input
            required
            aria-invalid={Boolean(state.errors?.date)}
            className="h-11"
            defaultValue={item?.item_date}
            id={fieldId("date")}
            name="date"
            type="date"
          />
          <FieldError>{state.errors?.date}</FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.time)}>
          <FieldLabel htmlFor={fieldId("time")}>Time</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.time)}
            className="h-11"
            defaultValue={item?.start_time?.slice(0, 5)}
            id={fieldId("time")}
            name="time"
            type="time"
          />
          <FieldDescription>Optional.</FieldDescription>
          <FieldError>{state.errors?.time}</FieldError>
        </Field>

        <Field className="sm:col-span-2" data-invalid={Boolean(state.errors?.title)}>
          <FieldLabel htmlFor={fieldId("title")}>Title</FieldLabel>
          <Input
            required
            aria-invalid={Boolean(state.errors?.title)}
            className="h-11"
            defaultValue={item?.title}
            id={fieldId("title")}
            maxLength={200}
            name="title"
            placeholder="Museum visit"
          />
          <FieldError>{state.errors?.title}</FieldError>
        </Field>

        <Field
          className="sm:col-span-2"
          data-invalid={Boolean(state.errors?.location)}
        >
          <FieldLabel htmlFor={fieldId("location")}>Location</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.location)}
            className="h-11"
            defaultValue={item?.location ?? ""}
            id={fieldId("location")}
            maxLength={200}
            name="location"
            placeholder="Address or meeting point"
          />
          <FieldDescription>Optional.</FieldDescription>
          <FieldError>{state.errors?.location}</FieldError>
        </Field>

        <Field className="sm:col-span-2" data-invalid={Boolean(state.errors?.notes)}>
          <FieldLabel htmlFor={fieldId("notes")}>Notes</FieldLabel>
          <Textarea
            aria-invalid={Boolean(state.errors?.notes)}
            defaultValue={item?.notes ?? ""}
            id={fieldId("notes")}
            maxLength={2000}
            name="notes"
            rows={3}
          />
          <FieldDescription>Optional.</FieldDescription>
          <FieldError>{state.errors?.notes}</FieldError>
        </Field>

        {state.message ? (
          <Alert
            variant="destructive"
            className="bg-destructive-muted sm:col-span-2"
          >
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        {state.success ? (
          <p className="text-sm text-success sm:col-span-2">
            {item ? "Itinerary item updated." : "Itinerary item added."}
          </p>
        ) : null}

        <Button
          disabled={pending}
          size="lg"
          className="h-11 px-5 text-base font-semibold sm:col-span-2 sm:justify-self-start"
        >
          {pending ? "Saving..." : item ? "Save changes" : "Add to itinerary"}
        </Button>
      </FieldGroup>
    </form>
  );
}

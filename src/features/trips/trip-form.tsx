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

import { createTrip, type CreateTripState } from "./actions";

const initialState: CreateTripState = {};

export function TripForm() {
  const [state, formAction, pending] = useActionState(createTrip, initialState);

  return (
    <form action={formAction} className="mt-6">
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <Field className="sm:col-span-2" data-invalid={Boolean(state.errors?.destination)}>
          <FieldLabel htmlFor="destination">Destination</FieldLabel>
          <Input
            required
            aria-invalid={Boolean(state.errors?.destination)}
            className="h-11"
            id="destination"
            maxLength={200}
            name="destination"
            placeholder="London, United Kingdom"
            aria-describedby={
              state.errors?.destination ? "destination-error" : undefined
            }
          />
          <FieldError id="destination-error">
            {state.errors?.destination}
          </FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.startDate)}>
          <FieldLabel htmlFor="startDate">Start date</FieldLabel>
          <Input
            required
            aria-invalid={Boolean(state.errors?.startDate)}
            className="h-11"
            id="startDate"
            name="startDate"
            type="date"
            aria-describedby={
              state.errors?.startDate ? "start-date-error" : undefined
            }
          />
          <FieldError id="start-date-error">
            {state.errors?.startDate}
          </FieldError>
        </Field>

        <Field data-invalid={Boolean(state.errors?.endDate)}>
          <FieldLabel htmlFor="endDate">End date</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.endDate)}
            className="h-11"
            id="endDate"
            name="endDate"
            type="date"
            aria-describedby={
              state.errors?.endDate ? "end-date-error" : undefined
            }
          />
          <FieldDescription>Optional.</FieldDescription>
          <FieldError id="end-date-error">{state.errors?.endDate}</FieldError>
        </Field>

        {state.message ? (
          <Alert
            variant="destructive"
            className="bg-destructive-muted sm:col-span-2"
          >
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="sm:col-span-2">
          <Button
            disabled={pending}
            size="lg"
            className="h-11 px-5 text-base font-semibold"
          >
            {pending ? "Creating trip..." : "Create trip"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

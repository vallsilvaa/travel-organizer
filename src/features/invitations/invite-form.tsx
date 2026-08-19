"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { inviteOrganizer, type InviteOrganizerState } from "./actions";

const initialState: InviteOrganizerState = {};

export function InviteForm({ tripId }: { tripId: string }) {
  const [state, formAction, pending] = useActionState(
    inviteOrganizer,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="tripId" value={tripId} />
      <Field className="flex-1">
        <FieldLabel htmlFor="invite-email">Organizer email</FieldLabel>
        <Input
          required
          autoComplete="email"
          className="h-11"
          id="invite-email"
          name="email"
          placeholder="organizer@example.com"
          type="email"
        />
      </Field>
      <Button
        disabled={pending}
        size="lg"
        className="h-11 px-5 text-base font-semibold"
      >
        {pending ? "Inviting..." : "Invite organizer"}
      </Button>
      {state.error ? (
        <Alert
          variant="destructive"
          className="bg-destructive-muted sm:basis-full"
        >
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.message ? (
        <p className="text-sm text-success sm:basis-full">{state.message}</p>
      ) : null}
    </form>
  );
}

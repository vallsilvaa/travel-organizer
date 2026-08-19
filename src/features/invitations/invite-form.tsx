"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  inviteOrganizer,
  type InviteOrganizerState,
} from "./actions";

const initialState: InviteOrganizerState = {};

export function InviteForm({ tripId }: { tripId: string }) {
  const [state, formAction, pending] = useActionState(
    inviteOrganizer,
    initialState,
  );

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="tripId" value={tripId} />
      <div className="flex-1 space-y-2">
        <Label htmlFor="email">Organizer email</Label>
        <Input
          required
          autoComplete="email"
          id="email"
          name="email"
          type="email"
          placeholder="organizer@example.com"
        />
      </div>
      <Button disabled={pending} size="lg">
        {pending ? "Inviting..." : "Invite organizer"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-emerald-700 sm:basis-full">{state.message}</p>
      ) : null}
    </form>
  );
}

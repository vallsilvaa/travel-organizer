"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

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

  useEffect(() => {
    if (state.message) {
      toast.success(state.message);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

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
    </form>
  );
}

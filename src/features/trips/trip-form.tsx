"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createTrip, type CreateTripState } from "./actions";

const initialState: CreateTripState = {};

export function TripForm() {
  const [state, formAction, pending] = useActionState(createTrip, initialState);

  useEffect(() => {
    if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="mt-6 grid gap-5 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="destination">Destination</Label>
        <Input
          required
          maxLength={200}
          id="destination"
          name="destination"
          placeholder="London, United Kingdom"
          aria-describedby={state.errors?.destination ? "destination-error" : undefined}
        />
        {state.errors?.destination ? (
          <p id="destination-error" className="text-sm text-destructive">
            {state.errors.destination}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate">Start date</Label>
        <Input
          required
          id="startDate"
          name="startDate"
          type="date"
          aria-describedby={state.errors?.startDate ? "start-date-error" : undefined}
        />
        {state.errors?.startDate ? (
          <p id="start-date-error" className="text-sm text-destructive">
            {state.errors.startDate}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate">
          End date <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="endDate"
          name="endDate"
          type="date"
          aria-describedby={state.errors?.endDate ? "end-date-error" : undefined}
        />
        {state.errors?.endDate ? (
          <p id="end-date-error" className="text-sm text-destructive">
            {state.errors.endDate}
          </p>
        ) : null}
      </div>

      <div className="sm:col-span-2">
        <Button disabled={pending} size="lg">
          {pending ? "Creating trip..." : "Create trip"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createTrip, updateTrip, type CreateTripState } from "./actions";

const initialState: CreateTripState = {};

type TripFormProps = {
  trip?: {
    id: string;
    destination: string;
    start_date: string;
    end_date: string | null;
  };
};

export function TripForm({ trip }: TripFormProps = {}) {
  const [state, formAction, pending] = useActionState(
    trip ? updateTrip : createTrip,
    initialState,
  );

  useEffect(() => {
    if (state.success && state.message) {
      toast.success(state.message);
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="mt-6 grid gap-5 sm:grid-cols-2">
      {trip ? <input type="hidden" name="tripId" value={trip.id} /> : null}
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="destination">Destino</Label>
        <Input
          required
          maxLength={200}
          id="destination"
          name="destination"
          placeholder="Londres, Reino Unido"
          defaultValue={trip?.destination}
          aria-describedby={state.errors?.destination ? "destination-error" : undefined}
        />
        {state.errors?.destination ? (
          <p id="destination-error" className="text-sm text-destructive">
            {state.errors.destination}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate">Data de início</Label>
        <Input
          required
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={trip?.start_date}
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
          Data de término <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={trip?.end_date ?? undefined}
          aria-describedby={state.errors?.endDate ? "end-date-error" : undefined}
        />
        {state.errors?.endDate ? (
          <p id="end-date-error" className="text-sm text-destructive">
            {state.errors.endDate}
          </p>
        ) : null}
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} size="lg">
          {pending
            ? trip ? "Salvando alterações..." : "Criando viagem..."
            : trip ? "Salvar alterações" : "Criar viagem"}
        </Button>
      </div>
    </form>
  );
}

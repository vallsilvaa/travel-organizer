"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  createReservation,
  updateReservation,
  type ReservationActionState,
} from "./actions";
import { reservationTypeLabels, reservationTypes } from "./validation";

type ReservationFormProps = {
  reservation?: {
    id: string;
    reservation_type: string;
    title: string;
    provider: string | null;
    confirmation_code: string | null;
    start_date: string;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
    location: string | null;
    destination_location: string | null;
    notes: string | null;
  };
  tripId: string;
};

const initialState: ReservationActionState = {};

export function ReservationForm({ reservation, tripId }: ReservationFormProps) {
  const action = reservation ? updateReservation : createReservation;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(reservation ? "Reserva atualizada." : "Reserva adicionada.");
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, reservation]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="tripId" value={tripId} />
      {reservation ? <input type="hidden" name="reservationId" value={reservation.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="reservation-type">Tipo</Label>
        <Select required name="reservationType" defaultValue={reservation?.reservation_type ?? "flight"}>
          <SelectTrigger id="reservation-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reservationTypes.map((type) => (
              <SelectItem key={type} value={type}>{reservationTypeLabels[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.reservationType ? <p className="text-sm text-destructive">{state.errors.reservationType}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-title">Título</Label>
        <Input
          required
          maxLength={200}
          id="reservation-title"
          name="title"
          defaultValue={reservation?.title}
          placeholder="Voo LATAM 3456"
        />
        {state.errors?.title ? <p className="text-sm text-destructive">{state.errors.title}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-provider">
          Fornecedor <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          maxLength={200}
          id="reservation-provider"
          name="provider"
          defaultValue={reservation?.provider ?? ""}
          placeholder="Companhia aérea, hotel ou empresa"
        />
        {state.errors?.provider ? <p className="text-sm text-destructive">{state.errors.provider}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-confirmationCode">
          Código de confirmação <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          maxLength={100}
          id="reservation-confirmationCode"
          name="confirmationCode"
          defaultValue={reservation?.confirmation_code ?? ""}
          placeholder="Localizador ou número da reserva"
          autoComplete="off"
        />
        {state.errors?.confirmationCode ? <p className="text-sm text-destructive">{state.errors.confirmationCode}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-startDate">Data de início</Label>
        <Input required id="reservation-startDate" name="startDate" type="date" defaultValue={reservation?.start_date} />
        {state.errors?.startDate ? <p className="text-sm text-destructive">{state.errors.startDate}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-startTime">
          Horário de início <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="reservation-startTime" name="startTime" type="time" defaultValue={reservation?.start_time?.slice(0, 5)} />
        {state.errors?.startTime ? <p className="text-sm text-destructive">{state.errors.startTime}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-endDate">
          Data de término <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="reservation-endDate" name="endDate" type="date" defaultValue={reservation?.end_date ?? ""} />
        {state.errors?.endDate ? <p className="text-sm text-destructive">{state.errors.endDate}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-endTime">
          Horário de término <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="reservation-endTime" name="endTime" type="time" defaultValue={reservation?.end_time?.slice(0, 5) ?? ""} />
        {state.errors?.endTime ? <p className="text-sm text-destructive">{state.errors.endTime}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-location">
          Local de origem <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          maxLength={200}
          id="reservation-location"
          name="location"
          defaultValue={reservation?.location ?? ""}
          placeholder="Aeroporto, endereço ou ponto de partida"
        />
        {state.errors?.location ? <p className="text-sm text-destructive">{state.errors.location}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reservation-destinationLocation">
          Local de destino <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          maxLength={200}
          id="reservation-destinationLocation"
          name="destinationLocation"
          defaultValue={reservation?.destination_location ?? ""}
          placeholder="Aeroporto, endereço ou ponto de chegada"
        />
        {state.errors?.destinationLocation ? <p className="text-sm text-destructive">{state.errors.destinationLocation}</p> : null}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="reservation-notes">
          Notas <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          maxLength={2000}
          id="reservation-notes"
          name="notes"
          defaultValue={reservation?.notes ?? ""}
          rows={3}
        />
        {state.errors?.notes ? <p className="text-sm text-destructive">{state.errors.notes}</p> : null}
      </div>

      <Button type="submit" disabled={pending} size="lg" className="sm:col-span-2 sm:justify-self-start">
        {pending ? "Salvando..." : reservation ? "Salvar alterações" : "Adicionar reserva"}
      </Button>
    </form>
  );
}

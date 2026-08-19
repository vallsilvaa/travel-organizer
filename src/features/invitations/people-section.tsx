import { UserPlusIcon, UsersIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { TripInvitation, TripParticipant } from "@/features/trips/types";

import { InviteForm } from "./invite-form";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return (parts.map((part) => part[0]).join("") || "T").toUpperCase();
}

type PeopleSectionProps = {
  invitations: TripInvitation[];
  isCreator: boolean;
  participants: TripParticipant[];
  tripId: string;
};

export function PeopleSection({
  invitations,
  isCreator,
  participants,
  tripId,
}: PeopleSectionProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <UsersIcon className="size-4.5 text-muted-foreground" />
          Participants
          <span className="text-muted-foreground tabular-nums">
            ({participants.length})
          </span>
        </h3>
        <ul className="mt-4 space-y-3">
          {participants.map((participant) => (
            <li key={participant.user_id} className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials(participant.display_name)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">
                {participant.display_name}
              </span>
              <Badge variant="secondary" className="ml-auto capitalize">
                {participant.role}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      {isCreator ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <UserPlusIcon className="size-4.5 text-primary" />
            Invite a travel organizer
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            They can accept after signing in with the same address.
          </p>
          <InviteForm tripId={tripId} />

          {invitations.length ? (
            <ul className="mt-6 divide-y divide-border border-t border-border">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm font-medium text-foreground">
                    {invitation.email}
                  </span>
                  <Badge
                    variant={
                      invitation.status === "accepted"
                        ? "default"
                        : invitation.status === "declined"
                          ? "destructive"
                          : "secondary"
                    }
                    className="capitalize"
                  >
                    {invitation.status}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

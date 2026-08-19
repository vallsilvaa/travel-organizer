import type { ItemComment } from "@/features/comments/comment-thread";
import type { TaskCategory } from "@/features/tasks/templates";

export type Trip = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
  created_by: string;
};

export type TripParticipant = {
  user_id: string;
  display_name: string;
  role: string;
};

export type TripComment = ItemComment & {
  item_type: "itinerary" | "task";
  itinerary_item_id: string | null;
  task_id: string | null;
};

export type ItineraryItem = {
  id: string;
  item_date: string;
  start_time: string | null;
  title: string;
  location: string | null;
  notes: string | null;
};

export type TripExpense = {
  id: string;
  description: string;
  amount: string;
  currency: string;
  category: string;
  expense_date: string;
  payer_id: string;
};

export type TripTask = {
  id: string;
  title: string;
  owner_id: string | null;
  due_date: string | null;
  due_offset_days: number | null;
  completed_at: string | null;
  created_at: string;
  category: TaskCategory;
  is_critical: boolean;
  template_key: string | null;
  reference_label: string | null;
  reference_url: string | null;
};

export type TripInvitation = {
  id: string;
  email: string;
  status: string;
  created_at: string;
};

export type TripSectionProps = {
  commentsFor: (itemType: "itinerary" | "task", itemId: string) => TripComment[];
  currentUserId: string;
  participantNames: Map<string, string>;
  participants: TripParticipant[];
  tripId: string;
};

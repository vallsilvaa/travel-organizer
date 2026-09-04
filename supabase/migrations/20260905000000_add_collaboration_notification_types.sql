-- New in-app notification types for issues #142/#144 (organizer <-> traveler
-- change alerts) and #145 (overdue task digest).
alter table public.notifications
  drop constraint notifications_notification_type_check;
alter table public.notifications
  add constraint notifications_notification_type_check check (
    notification_type in (
      'invitation', 'task_assigned', 'comment', 'deadline',
      'item_created', 'item_updated', 'item_deleted', 'task_overdue'
    )
  );

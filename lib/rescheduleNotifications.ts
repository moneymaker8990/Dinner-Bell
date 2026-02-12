import { supabase } from '@/lib/supabase';

/**
 * After event create or update: delete unsent notification_schedules for this event,
 * then insert reminder_30m, reminder_2h (optional), and bell.
 */
export async function rescheduleNotificationsForEvent(
  eventId: string,
  bellTimeIso: string,
  includeReminder2h: boolean = true
): Promise<void> {
  await supabase
    .from('notification_schedules')
    .delete()
    .eq('event_id', eventId)
    .is('sent_at', null);

  const bellTime = new Date(bellTimeIso);
  const reminder30 = new Date(bellTime.getTime() - 30 * 60 * 1000);
  const reminder2h = new Date(bellTime.getTime() - 2 * 60 * 60 * 1000);

  const rows: { event_id: string; scheduled_at: string; type: string }[] = [
    { event_id: eventId, scheduled_at: reminder30.toISOString(), type: 'reminder_30m' },
    { event_id: eventId, scheduled_at: bellTimeIso, type: 'bell' },
  ];
  if (includeReminder2h && reminder2h > new Date()) {
    rows.push({ event_id: eventId, scheduled_at: reminder2h.toISOString(), type: 'reminder_2h' });
  }
  await supabase.from('notification_schedules').insert(rows);
}

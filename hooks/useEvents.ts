import { supabase } from '@/lib/supabase';
import type { EventWithDetails } from '@/types/events';
import { useQuery } from '@tanstack/react-query';

interface EventsData {
  upcoming: EventWithDetails[];
  past: EventWithDetails[];
}

/** @internal Exported for testing */
export async function fetchEvents(userId: string): Promise<EventsData> {
  const now = new Date().toISOString();

  // Fetch hosted events
  const { data: hostEvents } = await supabase
    .from('events')
    .select('*')
    .eq('host_user_id', userId)
    .eq('is_cancelled', false)
    .gte('bell_time', now)
    .order('bell_time', { ascending: true });

  const hostIdList = (hostEvents ?? []).map((e: any) => e.id);

  // Fetch guest events
  const { data: guestRows } = await supabase
    .from('event_guests')
    .select('event_id')
    .eq('user_id', userId)
    .in('rsvp_status', ['going', 'maybe']);

  const guestEventIds = ((guestRows ?? []) as { event_id: string }[])
    .map((r) => r.event_id)
    .filter((eid) => !hostIdList.includes(eid));

  let guestEvents: EventWithDetails[] = [];
  if (guestEventIds.length > 0) {
    const { data } = await supabase
      .from('events')
      .select('*')
      .in('id', guestEventIds)
      .eq('is_cancelled', false)
      .gte('bell_time', now)
      .order('bell_time', { ascending: true });
    guestEvents = (data ?? []) as EventWithDetails[];
  }

  const upcoming = [
    ...((hostEvents ?? []) as EventWithDetails[]),
    ...guestEvents,
  ].sort((a, b) => new Date(a.bell_time).getTime() - new Date(b.bell_time).getTime());

  // Fetch past events
  const { data: pastHost } = await supabase
    .from('events')
    .select('*')
    .eq('host_user_id', userId)
    .lt('bell_time', now)
    .order('bell_time', { ascending: false })
    .limit(10);

  return {
    upcoming,
    past: (pastHost ?? []) as EventWithDetails[],
  };
}

/**
 * React Query hook for fetching user's upcoming and past events.
 */
export function useEvents(userId: string | undefined) {
  return useQuery({
    queryKey: ['events', userId],
    queryFn: () => fetchEvents(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

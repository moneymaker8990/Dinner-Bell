import { supabase } from '@/lib/supabase';
import type {
    BringItemRow,
    EventGuest,
    EventWithDetails,
    MenuItemRow,
    MenuSection,
    ScheduleBlockRow,
} from '@/types/events';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface EventFullData {
  event: EventWithDetails;
  menuSections: (MenuSection & { menu_items: MenuItemRow[] })[];
  bringItems: BringItemRow[];
  scheduleBlocks: ScheduleBlockRow[];
  guests: EventGuest[];
  hostName: string | null;
  coHostIds: string[];
}

/** @internal Exported for testing */
export async function fetchEventFull(eventId: string, userId?: string): Promise<EventFullData> {
  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError || !eventData) {
    throw new Error('Event not found');
  }

  const event = eventData as EventWithDetails;

  const { data: hostProfile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', event.host_user_id)
    .single();

  const [
    { data: sections },
    { data: items },
    { data: bring },
    { data: blocks },
    { data: guestList },
    { data: coHostsData },
  ] = await Promise.all([
    supabase.from('menu_sections').select('*').eq('event_id', eventId).order('sort_order'),
    supabase.from('menu_items').select('*').eq('event_id', eventId).order('sort_order'),
    supabase.from('bring_items').select('*').eq('event_id', eventId).order('sort_order'),
    supabase.from('schedule_blocks').select('*').eq('event_id', eventId).order('sort_order'),
    supabase.from('event_guests').select('*').eq('event_id', eventId),
    supabase.from('event_co_hosts').select('user_id').eq('event_id', eventId),
  ]);

  const sectionMap = new Map<string, MenuSection & { menu_items: MenuItemRow[] }>();
  (sections ?? []).forEach((s: MenuSection) => sectionMap.set(s.id, { ...s, menu_items: [] }));
  (items ?? []).forEach((item: MenuItemRow) => {
    const sec = sectionMap.get(item.section_id);
    if (sec) sec.menu_items.push(item);
  });

  return {
    event,
    menuSections: Array.from(sectionMap.values()).sort((a, b) => a.sort_order - b.sort_order),
    bringItems: bring ?? [],
    scheduleBlocks: blocks ?? [],
    guests: (guestList ?? []) as EventGuest[],
    hostName: (hostProfile as { name?: string } | null)?.name ?? null,
    coHostIds: (coHostsData ?? []).map((c: { user_id: string }) => c.user_id),
  };
}

/**
 * React Query hook for fetching a full event with all related data.
 * Provides caching, background refetch, and optimistic update support.
 */
export function useEvent(eventId: string | undefined, userId?: string) {
  return useQuery({
    queryKey: ['event', eventId],
    queryFn: () => fetchEventFull(eventId!, userId),
    enabled: !!eventId && eventId !== '__demo__',
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true,
  });
}

/** Invalidate event data to force refetch */
export function useInvalidateEvent() {
  const queryClient = useQueryClient();
  return (eventId: string) => {
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
  };
}

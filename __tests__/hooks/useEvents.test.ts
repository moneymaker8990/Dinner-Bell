import { fetchEvents } from '@/hooks/useEvents';
import { supabase } from '@/lib/supabase';

function chainMock(resolvedValue: { data: any; error: any }) {
  const chain: any = {};
  const methods = ['select', 'eq', 'in', 'gte', 'lt', 'order', 'limit'];
  methods.forEach((m) => {
    chain[m] = jest.fn(() => chain);
  });
  chain.single = jest.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve: any) => Promise.resolve(resolvedValue).then(resolve);
  return chain;
}

describe('fetchEvents', () => {
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  const pastDate = new Date(Date.now() - 86400000).toISOString();

  const upcomingEvent = { id: 'evt_upcoming', bell_time: futureDate, host_user_id: 'user_1' };
  const pastEvent = { id: 'evt_past', bell_time: pastDate, host_user_id: 'user_1' };

  beforeEach(() => {
    jest.clearAllMocks();

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'events') {
        callCount++;
        // First call: upcoming host events, later calls: past events
        if (callCount === 1) {
          return chainMock({ data: [upcomingEvent], error: null });
        }
        return chainMock({ data: [pastEvent], error: null });
      }
      if (table === 'event_guests') {
        return chainMock({ data: [], error: null });
      }
      return chainMock({ data: [], error: null });
    });
  });

  it('returns upcoming and past events', async () => {
    const result = await fetchEvents('user_1');

    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0].id).toBe('evt_upcoming');
    expect(result.past).toHaveLength(1);
    expect(result.past[0].id).toBe('evt_past');
  });

  it('returns empty arrays when no events', async () => {
    (supabase.from as jest.Mock).mockImplementation(() =>
      chainMock({ data: [], error: null })
    );

    const result = await fetchEvents('user_no_events');
    expect(result.upcoming).toEqual([]);
    expect(result.past).toEqual([]);
  });

  it('sorts upcoming events by bell_time ascending', async () => {
    const earlier = { id: 'evt_a', bell_time: new Date(Date.now() + 3600000).toISOString() };
    const later = { id: 'evt_b', bell_time: new Date(Date.now() + 7200000).toISOString() };

    let callCount = 0;
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'events') {
        callCount++;
        if (callCount === 1) return chainMock({ data: [later, earlier], error: null });
        return chainMock({ data: [], error: null });
      }
      if (table === 'event_guests') return chainMock({ data: [], error: null });
      return chainMock({ data: [], error: null });
    });

    const result = await fetchEvents('user_1');
    expect(result.upcoming[0].id).toBe('evt_a');
    expect(result.upcoming[1].id).toBe('evt_b');
  });
});

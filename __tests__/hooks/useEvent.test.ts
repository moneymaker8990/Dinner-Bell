import { fetchEventFull } from '@/hooks/useEvent';
import { supabase } from '@/lib/supabase';

// Build a chainable mock that tracks the table being queried
function chainMock(resolvedValue: { data: any; error: any }) {
  const chain: any = {};
  const methods = ['select', 'eq', 'in', 'gte', 'lt', 'order', 'limit'];
  methods.forEach((m) => {
    chain[m] = jest.fn(() => chain);
  });
  chain.single = jest.fn().mockResolvedValue(resolvedValue);
  // For Promise.all — make the chain thenable
  chain.then = (resolve: any) => Promise.resolve(resolvedValue).then(resolve);
  return chain;
}

describe('fetchEventFull', () => {
  const mockEvent = {
    id: 'evt_1',
    host_user_id: 'user_host',
    title: 'Test Dinner',
    bell_time: '2026-03-01T18:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Map table names to their mock responses
    const tableResponses: Record<string, any> = {
      events: { data: mockEvent, error: null },
      profiles: { data: { name: 'Host Name' }, error: null },
      menu_sections: { data: [{ id: 'sec_1', event_id: 'evt_1', title: 'Main', sort_order: 0 }], error: null },
      menu_items: { data: [{ id: 'item_1', event_id: 'evt_1', section_id: 'sec_1', name: 'Pasta', sort_order: 0 }], error: null },
      bring_items: { data: [], error: null },
      schedule_blocks: { data: [], error: null },
      event_guests: { data: [{ id: 'g_1', event_id: 'evt_1', user_id: 'user_1', guest_name: 'Alice' }], error: null },
      event_co_hosts: { data: [{ user_id: 'user_cohost' }], error: null },
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      return chainMock(tableResponses[table] ?? { data: null, error: null });
    });
  });

  it('returns fully assembled event data', async () => {
    const result = await fetchEventFull('evt_1', 'user_1');

    expect(result.event.id).toBe('evt_1');
    expect(result.hostName).toBe('Host Name');
    expect(result.menuSections).toHaveLength(1);
    expect(result.menuSections[0].menu_items).toHaveLength(1);
    expect(result.menuSections[0].menu_items[0].name).toBe('Pasta');
    expect(result.guests).toHaveLength(1);
    expect(result.coHostIds).toEqual(['user_cohost']);
    expect(result.bringItems).toEqual([]);
    expect(result.scheduleBlocks).toEqual([]);
  });

  it('throws when event is not found', async () => {
    (supabase.from as jest.Mock).mockImplementation(() =>
      chainMock({ data: null, error: { message: 'Not found' } })
    );

    await expect(fetchEventFull('missing_id')).rejects.toThrow('Event not found');
  });

  it('handles null host profile gracefully', async () => {
    const tableResponses: Record<string, any> = {
      events: { data: mockEvent, error: null },
      profiles: { data: null, error: null },
      menu_sections: { data: [], error: null },
      menu_items: { data: [], error: null },
      bring_items: { data: [], error: null },
      schedule_blocks: { data: [], error: null },
      event_guests: { data: [], error: null },
      event_co_hosts: { data: [], error: null },
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) =>
      chainMock(tableResponses[table] ?? { data: null, error: null })
    );

    const result = await fetchEventFull('evt_1');
    expect(result.hostName).toBeNull();
  });
});

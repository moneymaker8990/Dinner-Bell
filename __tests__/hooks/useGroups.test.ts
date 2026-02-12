import { fetchGroups } from '@/hooks/useGroups';
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

describe('fetchGroups', () => {
  const mockGroups = [
    { id: 'grp_1', name: 'Family', user_id: 'user_1', created_at: '2026-01-01' },
    { id: 'grp_2', name: 'Neighbors', user_id: 'user_1', created_at: '2026-01-02' },
  ];

  const mockMembers = [
    { id: 'm_1', group_id: 'grp_1', contact_type: 'phone', contact_value: '+1234567890', display_name: 'Mom', created_at: '2026-01-01' },
    { id: 'm_2', group_id: 'grp_1', contact_type: 'email', contact_value: 'dad@example.com', display_name: 'Dad', created_at: '2026-01-01' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'guest_groups') {
        return chainMock({ data: mockGroups, error: null });
      }
      if (table === 'guest_group_members') {
        return chainMock({ data: mockMembers, error: null });
      }
      return chainMock({ data: [], error: null });
    });
  });

  it('returns groups with their members', async () => {
    const result = await fetchGroups('user_1');

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Family');
    expect(result[0].members).toHaveLength(2);
    expect(result[0].members[0].display_name).toBe('Mom');
    expect(result[1].name).toBe('Neighbors');
  });

  it('returns empty array when no groups exist', async () => {
    (supabase.from as jest.Mock).mockImplementation(() =>
      chainMock({ data: [], error: null })
    );

    const result = await fetchGroups('user_no_groups');
    expect(result).toEqual([]);
  });

  it('returns empty array on error', async () => {
    (supabase.from as jest.Mock).mockImplementation(() =>
      chainMock({ data: null, error: { message: 'DB error' } })
    );

    const result = await fetchGroups('user_1');
    expect(result).toEqual([]);
  });

  it('handles groups with no members', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'guest_groups') {
        return chainMock({ data: [mockGroups[0]], error: null });
      }
      if (table === 'guest_group_members') {
        return chainMock({ data: [], error: null });
      }
      return chainMock({ data: [], error: null });
    });

    const result = await fetchGroups('user_1');
    expect(result).toHaveLength(1);
    expect(result[0].members).toEqual([]);
  });
});

import { fetchProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';

function chainMock(resolvedValue: { data: any; error: any; count?: number }) {
  const chain: any = {};
  const methods = ['select', 'eq', 'in', 'gte', 'lt', 'order', 'limit'];
  methods.forEach((m) => {
    chain[m] = jest.fn(() => chain);
  });
  chain.single = jest.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve: any) => Promise.resolve(resolvedValue).then(resolve);
  return chain;
}

describe('fetchProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return chainMock({
          data: { name: 'Jane Doe', phone: '+1234567890', avatar_url: 'https://example.com/avatar.jpg' },
          error: null,
        });
      }
      // Stats queries (events, event_guests, bring_items)
      if (table === 'events') return chainMock({ data: null, error: null, count: 5 });
      if (table === 'event_guests') return chainMock({ data: null, error: null, count: 12 });
      if (table === 'bring_items') return chainMock({ data: null, error: null, count: 3 });
      return chainMock({ data: null, error: null });
    });

    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { email: 'jane@example.com' } },
    });
  });

  it('returns profile data with stats', async () => {
    const result = await fetchProfile('user_1');

    expect(result.name).toBe('Jane Doe');
    expect(result.email).toBe('jane@example.com');
    expect(result.phone_number).toBe('+1234567890');
    expect(result.avatar_url).toBe('https://example.com/avatar.jpg');
    expect(result.stats).toBeDefined();
  });

  it('handles null profile gracefully', async () => {
    (supabase.from as jest.Mock).mockImplementation(() =>
      chainMock({ data: null, error: null, count: 0 })
    );

    const result = await fetchProfile('user_unknown');
    expect(result.name).toBeNull();
    expect(result.stats.hosted).toBe(0);
    expect(result.stats.attended).toBe(0);
    expect(result.stats.claimed).toBe(0);
  });

  it('returns null email when auth user is null', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
    });

    const result = await fetchProfile('user_1');
    expect(result.email).toBeNull();
  });
});

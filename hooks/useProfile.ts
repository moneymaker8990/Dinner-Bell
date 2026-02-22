import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface ProfileData {
  name: string | null;
  email: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  stats: {
    hosted: number;
    attended: number;
    claimed: number;
  };
}

/** @internal Exported for testing */
export async function fetchProfile(userId: string): Promise<ProfileData> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, phone, avatar_url')
    .eq('id', userId)
    .single();

  const { data: user } = await supabase.auth.getUser();
  const email = user?.user?.email ?? null;

  // Fetch stats
  const [
    { count: hostedCount },
    { count: attendedCount },
    { count: claimedCount },
  ] = await Promise.all([
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('host_user_id', userId),
    supabase.from('event_guests').select('*', { count: 'exact', head: true }).eq('user_id', userId).in('rsvp_status', ['going']),
    supabase.from('bring_items').select('*', { count: 'exact', head: true }).eq('claimed_by_guest_id', userId),
  ]);

  return {
    name: (profile as { name?: string } | null)?.name ?? null,
    email,
    phone_number: (profile as { phone?: string } | null)?.phone ?? null,
    avatar_url: (profile as { avatar_url?: string } | null)?.avatar_url ?? null,
    stats: {
      hosted: hostedCount ?? 0,
      attended: attendedCount ?? 0,
      claimed: claimedCount ?? 0,
    },
  };
}

/**
 * React Query hook for fetching the current user's profile and stats.
 */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Mutation hook for updating profile data.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: Partial<{ name: string; phone_number: string | null; avatar_url: string | null }>;
    }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.avatar_url !== undefined) dbUpdates.avatar_url = updates.avatar_url;
      if (updates.phone_number !== undefined) dbUpdates.phone = updates.phone_number;
      const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
    },
  });
}

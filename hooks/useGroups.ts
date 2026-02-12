import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface GuestGroup {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  contact_type: string;
  contact_value: string;
  display_name: string | null;
  created_at: string;
}

interface GroupWithMembers extends GuestGroup {
  members: GroupMember[];
}

/** @internal Exported for testing */
export async function fetchGroups(userId: string): Promise<GroupWithMembers[]> {
  const { data: groups, error } = await supabase
    .from('guest_groups')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !groups) return [];

  const groupsWithMembers: GroupWithMembers[] = [];
  for (const group of groups as GuestGroup[]) {
    const { data: members } = await supabase
      .from('guest_group_members')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at');

    groupsWithMembers.push({
      ...group,
      members: (members ?? []) as GroupMember[],
    });
  }

  return groupsWithMembers;
}

/**
 * React Query hook for fetching user's guest groups.
 */
export function useGroups(userId: string | undefined) {
  return useQuery({
    queryKey: ['groups', userId],
    queryFn: () => fetchGroups(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Mutation for creating a new group.
 */
export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, name }: { userId: string; name: string }) => {
      const { data, error } = await supabase
        .from('guest_groups')
        .insert({ user_id: userId, name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.userId] });
    },
  });
}

/**
 * Mutation for deleting a group.
 */
export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { error } = await supabase.from('guest_groups').delete().eq('id', groupId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.userId] });
    },
  });
}

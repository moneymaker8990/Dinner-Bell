import { supabase } from '@/lib/supabase';

export interface GuestGroup {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GuestGroupMember {
  id: string;
  group_id: string;
  contact_type: string;
  contact_value: string;
  display_name: string | null;
  sort_order: number;
}

export async function fetchGroups(): Promise<GuestGroup[]> {
  const { data, error } = await supabase.from('guest_groups').select('*').order('name');
  if (error) return [];
  return (data ?? []) as GuestGroup[];
}

export async function createGroup(name: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('guest_groups').insert({ user_id: user.id, name }).select('id').single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

export async function getGroupMembers(groupId: string): Promise<GuestGroupMember[]> {
  const { data, error } = await supabase.from('guest_group_members').select('*').eq('group_id', groupId).order('sort_order');
  if (error) return [];
  return (data ?? []) as GuestGroupMember[];
}

export async function addMemberToGroup(
  groupId: string,
  contactType: 'email' | 'phone',
  contactValue: string,
  displayName?: string
): Promise<boolean> {
  const { error } = await supabase.from('guest_group_members').insert({
    group_id: groupId,
    contact_type: contactType,
    contact_value: contactValue.trim(),
    display_name: displayName?.trim() ?? null,
    sort_order: 0,
  });
  return !error;
}

export async function removeMemberFromGroup(memberId: string): Promise<boolean> {
  const { error } = await supabase.from('guest_group_members').delete().eq('id', memberId);
  return !error;
}

export async function getGroup(groupId: string): Promise<GuestGroup | null> {
  const { data, error } = await supabase.from('guest_groups').select('*').eq('id', groupId).single();
  if (error || !data) return null;
  return data as GuestGroup;
}

export async function updateGroup(groupId: string, name: string): Promise<boolean> {
  const { error } = await supabase.from('guest_groups').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', groupId);
  return !error;
}

export async function deleteGroup(groupId: string): Promise<boolean> {
  const { error } = await supabase.from('guest_groups').delete().eq('id', groupId);
  return !error;
}

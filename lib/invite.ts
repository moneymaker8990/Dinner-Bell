import { supabase } from '@/lib/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export interface EventByInvite {
  id: string;
  host_user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  bell_time: string;
  end_time: string | null;
  timezone: string;
  location_name: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  location_notes: string | null;
  is_cancelled: boolean;
}

export async function getEventByInvite(
  eventId: string,
  token: string
): Promise<EventByInvite | null> {
  const { data, error } = await (supabase as any).rpc('get_event_by_invite', {
    p_event_id: eventId,
    p_token: token,
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  return data[0] as EventByInvite;
}

export interface InvitePreviewSection {
  id: string;
  title: string;
  sort_order: number;
}

export interface InvitePreviewMenuItem {
  id: string;
  section_id: string;
  name: string;
  notes: string | null;
  dietary_tags: string[] | null;
  sort_order: number;
}

export interface InvitePreviewBringItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  is_required: boolean;
  is_claimable: boolean;
  sort_order: number;
}

export interface InvitePreview {
  event: EventByInvite;
  menu_sections: InvitePreviewSection[];
  menu_items: InvitePreviewMenuItem[];
  bring_items: InvitePreviewBringItem[];
}

export async function getInvitePreview(
  eventId: string,
  token: string
): Promise<InvitePreview | null> {
  const { data, error } = await (supabase as any).rpc('get_invite_preview', {
    p_event_id: eventId,
    p_token: token,
  });
  if (error || !data) return null;
  return data as InvitePreview;
}

export type RsvpStatus = 'going' | 'maybe' | 'cant';

export async function addGuestByInvite(
  eventId: string,
  token: string,
  guestName: string,
  guestPhoneOrEmail: string,
  rsvpStatus: RsvpStatus = 'going',
  wantsReminders: boolean = true
): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('add_guest_by_invite', {
    p_event_id: eventId,
    p_token: token,
    p_guest_name: guestName,
    p_guest_phone_or_email: guestPhoneOrEmail,
    p_rsvp_status: rsvpStatus,
    p_wants_reminders: wantsReminders,
  });
  if (error || data == null) return null;
  return data as string;
}

export async function addGuestByHost(
  eventId: string,
  guestEmail: string,
  guestName?: string
): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('add_guest_by_host', {
    p_event_id: eventId,
    p_guest_email: guestEmail.trim(),
    p_guest_name: guestName?.trim() ?? null,
  });
  if (error || data == null) return null;
  return data as string;
}

/** Send "You're invited" push to a user with this email (host only). Call after addGuestByHost. */
export async function sendInvitePush(eventId: string, email: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return false;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-invite-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventId, email: email.trim() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function claimBringItem(
  bringItemId: string,
  guestId: string,
  claimedQuantity?: string,
  claimMessage?: string
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc('claim_bring_item', {
    p_bring_item_id: bringItemId,
    p_guest_id: guestId,
    p_claimed_quantity: claimedQuantity ?? null,
    p_claim_message: claimMessage ?? null,
  });
  return !error && data === true;
}

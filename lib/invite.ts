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
  cover_image_url?: string | null;
  is_cancelled: boolean;
  capacity?: number | null;
}

export async function getEventByInvite(
  eventId: string,
  token: string
): Promise<EventByInvite | null> {
  const { data, error } = await supabase.rpc('get_event_by_invite', {
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
  host_name: string | null;
  guest_count?: number;
  menu_sections: InvitePreviewSection[];
  menu_items: InvitePreviewMenuItem[];
  bring_items: InvitePreviewBringItem[];
}

export async function getInvitePreview(
  eventId: string,
  token: string
): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('get_invite_preview', {
    p_event_id: eventId,
    p_token: token,
  });
  if (error || !data) return null;
  return data as InvitePreview;
}

export type RsvpStatus = 'going' | 'maybe' | 'cant' | 'late';

export type InviteMutationResult = {
  data: string | null;
  error: string | null;
  code?: string | null;
};

function toInviteErrorMessage(message?: string | null): string {
  const lower = (message ?? '').toLowerCase();
  if (lower.includes('duplicate') || lower.includes('already exists')) {
    return 'That guest is already invited.';
  }
  if (lower.includes('invalid') && lower.includes('phone')) {
    return 'Please enter a valid phone number.';
  }
  if (lower.includes('permission') || lower.includes('not authenticated')) {
    return 'You do not have permission to send this invite.';
  }
  return 'Unable to send the invitation right now. Please try again.';
}

export async function addGuestByInvite(
  eventId: string,
  token: string,
  guestName: string,
  guestPhoneOrEmail: string,
  rsvpStatus: RsvpStatus = 'going',
  wantsReminders: boolean = true
): Promise<InviteMutationResult> {
  try {
    const { data, error } = await supabase.rpc('add_guest_by_invite', {
      p_event_id: eventId,
      p_token: token,
      p_guest_name: guestName,
      p_guest_phone_or_email: guestPhoneOrEmail,
      p_rsvp_status: rsvpStatus,
      p_wants_reminders: wantsReminders,
    });
    if (error || data == null) {
      return {
        data: null,
        error: toInviteErrorMessage(error?.message),
        code: error?.code,
      };
    }
    return { data: data as string, error: null, code: null };
  } catch {
    return { data: null, error: 'Network error while submitting RSVP. Please try again.', code: null };
  }
}

export async function addGuestByHost(
  eventId: string,
  guestEmail: string,
  guestName?: string
): Promise<InviteMutationResult> {
  try {
    const { data, error } = await supabase.rpc('add_guest_by_host', {
      p_event_id: eventId,
      p_guest_email: guestEmail.trim(),
      p_guest_name: guestName?.trim() ?? null,
    });
    if (error || data == null) {
      return {
        data: null,
        error: toInviteErrorMessage(error?.message),
        code: error?.code,
      };
    }
    return { data: data as string, error: null, code: null };
  } catch {
    return { data: null, error: 'Network error while sending invite. Please try again.', code: null };
  }
}

/** Normalize phone to digits-only for storage and lookup. */
export function normalizePhoneForLookup(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function addGuestByHostPhone(
  eventId: string,
  guestPhone: string,
  guestName?: string
): Promise<InviteMutationResult> {
  const normalized = normalizePhoneForLookup(guestPhone);
  if (normalized.length < 10) {
    return { data: null, error: 'Please enter a valid phone number.', code: 'INVALID_PHONE' };
  }
  try {
    const { data, error } = await supabase.rpc('add_guest_by_host_phone', {
      p_event_id: eventId,
      p_guest_phone: normalized,
      p_guest_name: guestName?.trim() ?? null,
    });
    if (error || data == null) {
      return {
        data: null,
        error: toInviteErrorMessage(error?.message),
        code: error?.code,
      };
    }
    return { data: data as string, error: null, code: null };
  } catch {
    return { data: null, error: 'Network error while sending invite. Please try again.', code: null };
  }
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

/** Send "You're invited" push to a user with this phone (host only). Call after addGuestByHostPhone. */
export async function sendInvitePushByPhone(eventId: string, phone: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return false;
  const normalized = normalizePhoneForLookup(phone);
  if (normalized.length < 10) return false;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-invite-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventId, phone: normalized }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function invokeInviteFunction(
  functionName: string,
  payload: Record<string, string | null | undefined>
): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return false;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Send transactional email invite after guest is added. */
export async function sendInviteEmail(
  eventId: string,
  email: string,
  guestName?: string
): Promise<boolean> {
  return invokeInviteFunction('send-invite-email', {
    eventId,
    email: email.trim().toLowerCase(),
    guestName: guestName?.trim(),
  });
}

/** Send transactional SMS invite after guest is added. */
export async function sendInviteSms(
  eventId: string,
  phone: string,
  guestName?: string
): Promise<boolean> {
  const normalized = normalizePhoneForLookup(phone);
  if (normalized.length < 10) return false;
  return invokeInviteFunction('send-invite-sms', {
    eventId,
    phone: normalized,
    guestName: guestName?.trim(),
  });
}

export async function claimBringItem(
  bringItemId: string,
  guestId: string,
  claimedQuantity?: string,
  claimMessage?: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_bring_item', {
    p_bring_item_id: bringItemId,
    p_guest_id: guestId,
    p_claimed_quantity: claimedQuantity ?? null,
    p_claim_message: claimMessage ?? null,
  });
  return !error && data === true;
}

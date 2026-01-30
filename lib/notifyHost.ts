import { supabase } from '@/lib/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export async function notifyHostRsvpChange(eventId: string, guestName: string): Promise<boolean> {
  const url = `${supabaseUrl}/functions/v1/notify-host`;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventId, type: 'rsvp_change', guestName }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function notifyHostBringClaimed(eventId: string, guestName: string, itemName: string): Promise<boolean> {
  const url = `${supabaseUrl}/functions/v1/notify-host`;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventId, type: 'bring_claimed', guestName, itemName }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

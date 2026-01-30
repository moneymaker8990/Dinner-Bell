import { supabase } from '@/lib/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export async function triggerBellPush(eventId: string, message?: string): Promise<boolean> {
  const url = `${supabaseUrl}/functions/v1/send-bell`;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ eventId, message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const now = new Date().toISOString();
    const { data: due } = await supabase
      .from('notification_schedules')
      .select('id, event_id, type')
      .lte('scheduled_at', now)
      .is('sent_at', null);
    if (!due?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
    for (const row of due) {
      const { data: eventRow } = row.type === 'bell' ? await supabase.from('events').select('bell_sound').eq('id', row.event_id).single() : { data: null };
      const bellSound = (eventRow as { bell_sound?: string } | null)?.bell_sound ?? 'chime';
      const { data: guests } = await supabase
        .from('event_guests')
        .select('user_id, rsvp_status, wants_reminders')
        .eq('event_id', row.event_id);
      const eligible = (guests ?? []).filter((g: { user_id: string | null; rsvp_status: string; wants_reminders: boolean }) => {
        if (!g.user_id) return false;
        if (g.rsvp_status === 'going') return true;
        if (g.rsvp_status === 'maybe' && g.wants_reminders) return true;
        return false;
      });
      const userIds = eligible.map((g: { user_id: string }) => g.user_id);
      if (userIds.length === 0) {
        await supabase.from('notification_schedules').update({ sent_at: now }).eq('id', row.id);
        continue;
      }
      const { data: profiles } = await supabase.from('profiles').select('push_token').in('id', userIds);
      const tokens = (profiles ?? []).map((p: { push_token: string | null }) => p.push_token).filter(Boolean) as string[];
      const title = row.type === 'bell' ? 'Dinner Bell!' : 'Reminder';
      const body = row.type === 'bell' ? 'Time to eat.' : row.type === 'reminder_2h' ? 'Your dinner is in 2 hours.' : 'Your dinner is coming up.';
      const pushData: Record<string, string> = row.type === 'bell' ? { type: 'bell_ring', eventId: row.event_id, bellSound } : { type: 'reminder', eventId: row.event_id };
      for (const token of tokens) {
        await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: token,
            title,
            body,
            data: pushData,
          }),
        });
      }
      await supabase.from('notification_schedules').update({ sent_at: now }).eq('id', row.id);
    }
    return new Response(JSON.stringify({ sent: due.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

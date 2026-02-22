import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { eventId, message } = (await req.json()) as { eventId: string; message?: string };
    if (!eventId) return new Response(JSON.stringify({ error: 'eventId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: event } = await supabaseAdmin.from('events').select('host_user_id, bell_sound').eq('id', eventId).single();
    if (!event || event.host_user_id !== user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const supabase = supabaseAdmin;
    const { data: guests } = await supabase
      .from('event_guests')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('rsvp_status', 'going');
    const userIds = (guests ?? []).map((g) => g.user_id).filter(Boolean);
    const { data: profiles } = await supabase.from('profiles').select('push_token').in('id', userIds);
    const tokens = (profiles ?? []).map((p) => p.push_token).filter(Boolean) as string[];
    const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
    for (const token of tokens) {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title: 'Dinner Bell!',
          body: message ?? 'Time to eat.',
          data: { type: 'bell_ring', eventId, message, bellSound: event.bell_sound ?? 'triangle' },
        }),
      });
    }
    return new Response(JSON.stringify({ sent: tokens.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

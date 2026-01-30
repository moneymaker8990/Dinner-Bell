import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const body = (await req.json()) as { eventId: string; type: 'bring_claimed' | 'rsvp_change' | 'bring_unclaimed'; message?: string; guestName?: string; itemName?: string };
    const { eventId, type, message, guestName, itemName } = body;
    if (!eventId || !type) return new Response(JSON.stringify({ error: 'eventId and type required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: event } = await supabase.from('events').select('host_user_id').eq('id', eventId).single();
    if (!event) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const isHost = event.host_user_id === user.id;
    const { data: guestRow } = await supabase.from('event_guests').select('id').eq('event_id', eventId).eq('user_id', user.id).maybeSingle();
    const isGuest = !!guestRow;
    if (!isHost && !isGuest) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: profile } = await supabase.from('profiles').select('push_token').eq('id', event.host_user_id).single();
    const token = profile?.push_token;
    if (!token) return new Response(JSON.stringify({ sent: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const title = type === 'bring_unclaimed' ? 'Bring item unclaimed' : type === 'bring_claimed' ? 'Bring item claimed' : 'RSVP update';
    const bodyText = message ?? (type === 'bring_unclaimed' ? `${guestName ?? 'Someone'} unclaimed ${itemName ?? 'an item'}` : type === 'bring_claimed' ? `${guestName ?? 'Someone'} claimed ${itemName ?? 'an item'}` : `${guestName ?? 'Someone'} responded to your invite`);
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body: bodyText, data: { type, eventId } }),
    });
    return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

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
    const body = (await req.json()) as { eventId: string; email: string };
    const { eventId, email } = body;
    if (!eventId || !email) return new Response(JSON.stringify({ error: 'eventId and email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: event } = await supabase.from('events').select('host_user_id, title').eq('id', eventId).single();
    if (!event || event.host_user_id !== user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const normalized = (email as string).trim().toLowerCase();
    const { data: profile } = await supabase.from('profiles').select('push_token').eq('email', normalized).maybeSingle();
    const token = profile?.push_token;
    if (!token) return new Response(JSON.stringify({ sent: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const title = "You're invited";
    const bodyText = `You're invited to ${event.title}. Open the link to RSVP.`;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title,
        body: bodyText,
        data: { type: 'invite_received', eventId },
      }),
    });
    return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

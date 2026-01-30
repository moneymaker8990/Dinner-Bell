import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const body = (await req.json()) as { eventId: string; email?: string; phone?: string };
    const { eventId, email, phone } = body;
    if (!eventId || (!email && !phone)) return new Response(JSON.stringify({ error: 'eventId and email or phone required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: event } = await supabase.from('events').select('host_user_id, title, invite_token').eq('id', eventId).single();
    if (!event || event.host_user_id !== user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    let profile: { push_token: string | null } | null = null;
    if (email) {
      const normalizedEmail = (email as string).trim().toLowerCase();
      const { data } = await supabase.from('profiles').select('push_token').eq('email', normalizedEmail).maybeSingle();
      profile = data;
    }
    if (!profile?.push_token && phone) {
      const normalizedPhone = (phone as string).replace(/\D/g, '');
      const { data: pushToken } = await supabase.rpc('get_push_token_by_phone', { p_normalized_phone: normalizedPhone });
      profile = pushToken ? { push_token: pushToken } : null;
    }
    const token = profile?.push_token;
    if (!token) return new Response(JSON.stringify({ sent: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const title = "You're invited";
    const bodyText = `You're invited to ${event.title}. Tap to RSVP.`;
    const data: Record<string, string> = { type: 'invite_received', eventId };
    if (event.invite_token) data.token = event.invite_token;
    if (email) data.email = (email as string).trim().toLowerCase();
    if (phone) data.phone = (phone as string).replace(/\D/g, '');
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title,
        body: bodyText,
        data,
      }),
    });
    return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

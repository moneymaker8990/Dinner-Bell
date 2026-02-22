import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Payload = {
  eventId: string;
  email: string;
  guestName?: string | null;
};

function getBaseUrl(req: Request): string {
  const explicit = Deno.env.get('INVITE_BASE_URL')?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return req.headers.get('origin')?.replace(/\/+$/, '') || 'https://dinner-bell-app.vercel.app';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Payload;
    const eventId = body.eventId?.trim();
    const guestEmail = body.email?.trim().toLowerCase();
    if (!eventId || !guestEmail) {
      return new Response(JSON.stringify({ error: 'eventId and email are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('host_user_id, title, invite_token')
      .eq('id', eventId)
      .single();

    if (eventError || !event || event.host_user_id !== authData.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', authData.user.id)
      .maybeSingle();

    const hostName = profile?.name || authData.user.email || 'Your host';
    const inviteUrl = `${getBaseUrl(req)}/invite/${eventId}?token=${event.invite_token}`;
    const guestName = body.guestName?.trim();
    const emailApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const fromAddress = Deno.env.get('INVITE_FROM_EMAIL') || 'Dinner Bell <invites@dinner-bell.app>';

    if (!emailApiKey) {
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messageHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>You're invited to ${event.title}</h2>
        <p>${hostName} invited ${guestName || 'you'} to dinner.</p>
        <p><a href="${inviteUrl}" style="background:#C89F2D;color:#fff;padding:10px 14px;text-decoration:none;border-radius:6px;">Open invite</a></p>
        <p>Or paste this link into your browser:</p>
        <p>${inviteUrl}</p>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${emailApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [guestEmail],
        subject: `You're invited to ${event.title}`,
        html: messageHtml,
      }),
    });

    if (!resendResponse.ok) {
      const details = await resendResponse.text();
      return new Response(JSON.stringify({ error: `Email send failed: ${details}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

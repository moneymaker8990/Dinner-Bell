import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Payload = {
  eventId: string;
  phone: string;
  guestName?: string | null;
};

function normalizeToE164(phone: string): string {
  if (phone.startsWith('+')) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

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
    const rawPhone = body.phone?.trim();
    if (!eventId || !rawPhone) {
      return new Response(JSON.stringify({ error: 'eventId and phone are required' }), {
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
    const toPhone = normalizeToE164(rawPhone);

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
    const fromPhone = Deno.env.get('TWILIO_PHONE_NUMBER') ?? '';
    const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') ?? '';

    const useMessagingService = messagingServiceSid.length > 0;
    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: 'Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!useMessagingService && !fromPhone) {
      return new Response(JSON.stringify({ error: 'Set TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const text = `${hostName} invited you to ${event.title}. RSVP: ${inviteUrl}`;
    const form = new URLSearchParams();
    form.set('To', toPhone);
    if (useMessagingService) {
      form.set('MessagingServiceSid', messagingServiceSid);
    } else {
      form.set('From', fromPhone);
    }
    form.set('Body', text);

    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!twilioRes.ok) {
      const details = await twilioRes.text();
      return new Response(JSON.stringify({ error: `SMS send failed: ${details}` }), {
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

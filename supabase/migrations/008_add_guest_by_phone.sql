-- RPC: host adds a guest by phone (for "Add from contacts" and invite-received push)
CREATE OR REPLACE FUNCTION public.add_guest_by_host_phone(
  p_event_id UUID,
  p_guest_phone TEXT,
  p_guest_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_guest_id UUID;
  v_user_id UUID;
  v_normalized TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND host_user_id = auth.uid() AND is_cancelled = false) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_normalized := regexp_replace(p_guest_phone, '[^0-9]', '', 'g');
  IF length(v_normalized) < 10 THEN
    RAISE EXCEPTION 'Invalid phone number';
  END IF;
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_normalized
  LIMIT 1;
  INSERT INTO public.event_guests (event_id, guest_name, guest_phone_or_email, rsvp_status, wants_reminders, user_id)
  VALUES (
    p_event_id,
    COALESCE(NULLIF(trim(p_guest_name), ''), 'Guest'),
    v_normalized,
    'going',
    true,
    v_user_id
  )
  ON CONFLICT (event_id, guest_phone_or_email) DO UPDATE SET
    guest_name = COALESCE(EXCLUDED.guest_name, event_guests.guest_name),
    user_id = COALESCE(EXCLUDED.user_id, event_guests.user_id),
    updated_at = now()
  RETURNING id INTO v_guest_id;
  RETURN v_guest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.add_guest_by_host_phone(UUID, TEXT, TEXT) TO authenticated;

-- RPC: get push_token by normalized phone (for send-invite-push edge function)
CREATE OR REPLACE FUNCTION public.get_push_token_by_phone(p_normalized_phone TEXT)
RETURNS TEXT AS $$
  SELECT push_token FROM public.profiles
  WHERE push_token IS NOT NULL AND length(regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g')) > 0
    AND regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g') = p_normalized_phone
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_push_token_by_phone(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_push_token_by_phone(TEXT) TO authenticated;

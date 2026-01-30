-- RPC: host adds a guest by email (for "Invite more" and invite-received push)
CREATE OR REPLACE FUNCTION public.add_guest_by_host(
  p_event_id UUID,
  p_guest_email TEXT,
  p_guest_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_guest_id UUID;
  v_user_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND host_user_id = auth.uid() AND is_cancelled = false) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT id INTO v_user_id FROM public.profiles WHERE email = trim(lower(p_guest_email)) LIMIT 1;
  INSERT INTO public.event_guests (event_id, guest_name, guest_phone_or_email, rsvp_status, wants_reminders, user_id)
  VALUES (
    p_event_id,
    COALESCE(NULLIF(trim(p_guest_name), ''), split_part(trim(p_guest_email), '@', 1)),
    trim(p_guest_email),
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

GRANT EXECUTE ON FUNCTION public.add_guest_by_host(UUID, TEXT, TEXT) TO authenticated;

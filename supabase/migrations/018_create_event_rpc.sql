-- Create event via RPC so we don't rely on RLS for INSERT (avoids 403 when session/RLS is inconsistent). Deploy trigger.
CREATE OR REPLACE FUNCTION public.create_event(
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_bell_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_timezone TEXT DEFAULT 'UTC',
  p_location_name TEXT DEFAULT NULL,
  p_address_line1 TEXT DEFAULT '',
  p_address_line2 TEXT DEFAULT NULL,
  p_city TEXT DEFAULT '',
  p_state TEXT DEFAULT '',
  p_postal_code TEXT DEFAULT '',
  p_country TEXT DEFAULT '',
  p_location_notes TEXT DEFAULT NULL,
  p_invite_note TEXT DEFAULT NULL,
  p_invite_token TEXT DEFAULT NULL,
  p_theme_slug TEXT DEFAULT NULL,
  p_accent_color TEXT DEFAULT NULL,
  p_capacity INT DEFAULT NULL,
  p_bell_sound TEXT DEFAULT 'triangle',
  p_is_public BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_token TEXT;
  v_event_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  v_token := COALESCE(NULLIF(trim(p_invite_token), ''), encode(gen_random_bytes(18), 'hex'));
  INSERT INTO public.events (
    host_user_id, title, description, start_time, bell_time, end_time, timezone,
    location_name, address_line1, address_line2, city, state, postal_code, country,
    location_notes, invite_note, invite_token, is_cancelled,
    theme_slug, accent_color, capacity, bell_sound, is_public
  ) VALUES (
    v_user_id, p_title, p_description, COALESCE(p_start_time, now()), COALESCE(p_bell_time, now()),
    p_end_time, COALESCE(p_timezone, 'UTC'), p_location_name,
    COALESCE(p_address_line1, ''), p_address_line2, COALESCE(p_city, ''), COALESCE(p_state, ''),
    COALESCE(p_postal_code, ''), COALESCE(p_country, ''), p_location_notes, p_invite_note,
    v_token, false, p_theme_slug, p_accent_color, p_capacity, COALESCE(p_bell_sound, 'triangle'),
    COALESCE(p_is_public, false)
  )
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;
-- 21 params: title, description, start_time, bell_time, end_time, timezone, location_name, address_line1, address_line2, city, state, postal_code, country, location_notes, invite_note, invite_token, theme_slug, accent_color, capacity, bell_sound, is_public
GRANT EXECUTE ON FUNCTION public.create_event(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN) TO authenticated;

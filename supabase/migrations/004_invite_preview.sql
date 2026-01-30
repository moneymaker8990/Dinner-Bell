-- RPC: get event + menu + bring list for invite preview (before RSVP, anon)
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_event_id UUID, p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_sections JSON;
  v_items JSON;
  v_bring JSON;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND invite_token = p_token AND is_cancelled = false;
  IF v_event.id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(json_agg(row_to_json(ms) ORDER BY sort_order), '[]') INTO v_sections
  FROM (SELECT id, title, sort_order FROM public.menu_sections WHERE event_id = p_event_id) ms;
  SELECT COALESCE(json_agg(row_to_json(mi) ORDER BY sort_order), '[]') INTO v_items
  FROM (SELECT id, section_id, name, notes, dietary_tags, sort_order FROM public.menu_items WHERE event_id = p_event_id) mi;
  SELECT COALESCE(json_agg(row_to_json(bi) ORDER BY sort_order), '[]') INTO v_bring
  FROM (SELECT id, name, quantity, category, is_required, is_claimable, sort_order FROM public.bring_items WHERE event_id = p_event_id) bi;
  RETURN json_build_object(
    'event', row_to_json(v_event),
    'menu_sections', v_sections,
    'menu_items', v_items,
    'bring_items', v_bring
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_preview(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(UUID, TEXT) TO authenticated;

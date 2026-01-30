-- RPC: get full event for a guest by guest_id (for unauthenticated invite flow)
CREATE OR REPLACE FUNCTION public.get_event_by_guest_id(p_event_id UUID, p_guest_id UUID)
RETURNS SETOF public.events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.* FROM public.events e
  JOIN public.event_guests g ON g.event_id = e.id AND g.id = p_guest_id
  WHERE e.id = p_event_id AND e.is_cancelled = false;
$$;

-- RPC: get event + menu, bring_items, schedule_blocks for guest (anon-friendly)
CREATE OR REPLACE FUNCTION public.get_event_full_for_guest(p_event_id UUID, p_guest_id UUID)
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
  v_blocks JSON;
  v_guests JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.event_guests WHERE id = p_guest_id AND event_id = p_event_id) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND is_cancelled = false;
  IF v_event.id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(json_agg(row_to_json(ms) ORDER BY sort_order), '[]') INTO v_sections
  FROM (SELECT * FROM public.menu_sections WHERE event_id = p_event_id) ms;
  SELECT COALESCE(json_agg(row_to_json(mi) ORDER BY sort_order), '[]') INTO v_items
  FROM (SELECT * FROM public.menu_items WHERE event_id = p_event_id) mi;
  SELECT COALESCE(json_agg(row_to_json(bi) ORDER BY sort_order), '[]') INTO v_bring
  FROM (SELECT * FROM public.bring_items WHERE event_id = p_event_id) bi;
  SELECT COALESCE(json_agg(row_to_json(sb) ORDER BY sort_order), '[]') INTO v_blocks
  FROM (SELECT * FROM public.schedule_blocks WHERE event_id = p_event_id) sb;
  SELECT COALESCE(json_agg(row_to_json(eg)), '[]') INTO v_guests
  FROM (SELECT id, guest_name, rsvp_status FROM public.event_guests WHERE event_id = p_event_id) eg;
  RETURN json_build_object(
    'event', row_to_json(v_event),
    'menu_sections', v_sections,
    'menu_items', v_items,
    'bring_items', v_bring,
    'schedule_blocks', v_blocks,
    'guests', v_guests
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_by_guest_id(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_by_guest_id(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_full_for_guest(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_full_for_guest(UUID, UUID) TO authenticated;

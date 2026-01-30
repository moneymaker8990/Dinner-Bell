-- Phase 1: Invite & Presence
-- Add "Running late" to RSVP options
DO $$ BEGIN
  ALTER TYPE rsvp_status ADD VALUE 'late';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extend get_invite_preview to include host name and bring summary for rich cards
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_event_id UUID, p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_host_name TEXT;
  v_sections JSON;
  v_items JSON;
  v_bring JSON;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND invite_token = p_token AND is_cancelled = false;
  IF v_event.id IS NULL THEN RETURN NULL; END IF;
  SELECT name INTO v_host_name FROM public.profiles WHERE id = v_event.host_user_id;
  SELECT COALESCE(json_agg(row_to_json(ms) ORDER BY sort_order), '[]') INTO v_sections
  FROM (SELECT id, title, sort_order FROM public.menu_sections WHERE event_id = p_event_id) ms;
  SELECT COALESCE(json_agg(row_to_json(mi) ORDER BY sort_order), '[]') INTO v_items
  FROM (SELECT id, section_id, name, notes, dietary_tags, sort_order FROM public.menu_items WHERE event_id = p_event_id) mi;
  SELECT COALESCE(json_agg(row_to_json(bi) ORDER BY sort_order), '[]') INTO v_bring
  FROM (SELECT id, name, quantity, category, is_required, is_claimable, sort_order FROM public.bring_items WHERE event_id = p_event_id) bi;
  RETURN json_build_object(
    'event', row_to_json(v_event),
    'host_name', v_host_name,
    'menu_sections', v_sections,
    'menu_items', v_items,
    'bring_items', v_bring
  );
END;
$$;

-- Ensure event_guests.status_updated_at is set when rsvp_status changes
CREATE OR REPLACE FUNCTION public.set_guest_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.rsvp_status IS DISTINCT FROM NEW.rsvp_status THEN
    NEW.status_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_guests_rsvp_updated ON public.event_guests;
CREATE TRIGGER event_guests_rsvp_updated
  BEFORE UPDATE ON public.event_guests
  FOR EACH ROW EXECUTE FUNCTION public.set_guest_status_updated_at();

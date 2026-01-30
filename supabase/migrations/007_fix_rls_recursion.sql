-- Fix: "infinite recursion detected in policy for relation events"
-- RLS policies were cross-referencing events <-> event_guests. Use SECURITY DEFINER
-- helpers so the check runs without re-invoking RLS.

CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND host_user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = p_event_id AND user_id = p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.is_event_host(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_guest(UUID, UUID) TO anon, authenticated;

-- Events: avoid SELECT from event_guests in policy (causes recursion)
DROP POLICY IF EXISTS "Guests can view events they are invited to" ON public.events;
CREATE POLICY "Guests can view events they are invited to" ON public.events
  FOR SELECT USING (public.is_event_guest(id, auth.uid()));

-- Event_guests: avoid SELECT from events in policy
DROP POLICY IF EXISTS "Host can manage event guests" ON public.event_guests;
DROP POLICY IF EXISTS "Guests can view event guests" ON public.event_guests;
CREATE POLICY "Host can manage event guests" ON public.event_guests
  FOR ALL USING (public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Guests can view event guests" ON public.event_guests
  FOR SELECT USING (
    public.is_event_guest(event_id, auth.uid()) OR public.is_event_host(event_id, auth.uid())
  );

-- Menu sections: use helpers instead of direct EXISTS on events/event_guests
DROP POLICY IF EXISTS "Host can manage menu_sections" ON public.menu_sections;
DROP POLICY IF EXISTS "Guests can view menu_sections" ON public.menu_sections;
CREATE POLICY "Host can manage menu_sections" ON public.menu_sections
  FOR ALL USING (public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Guests can view menu_sections" ON public.menu_sections
  FOR SELECT USING (public.is_event_guest(event_id, auth.uid()));

-- Menu items
DROP POLICY IF EXISTS "Host can manage menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Guests can view menu_items" ON public.menu_items;
CREATE POLICY "Host can manage menu_items" ON public.menu_items
  FOR ALL USING (public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Guests can view menu_items" ON public.menu_items
  FOR SELECT USING (public.is_event_guest(event_id, auth.uid()));

-- Bring items
DROP POLICY IF EXISTS "Host can manage bring_items" ON public.bring_items;
DROP POLICY IF EXISTS "Guests can view bring_items" ON public.bring_items;
DROP POLICY IF EXISTS "Guests can claim bring_items" ON public.bring_items;
CREATE POLICY "Host can manage bring_items" ON public.bring_items
  FOR ALL USING (public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Guests can view bring_items" ON public.bring_items
  FOR SELECT USING (public.is_event_guest(event_id, auth.uid()));
CREATE POLICY "Guests can claim bring_items" ON public.bring_items
  FOR UPDATE USING (
    is_claimable AND public.is_event_guest(event_id, auth.uid())
  );

-- Schedule blocks
DROP POLICY IF EXISTS "Host can manage schedule_blocks" ON public.schedule_blocks;
DROP POLICY IF EXISTS "Guests can view schedule_blocks" ON public.schedule_blocks;
CREATE POLICY "Host can manage schedule_blocks" ON public.schedule_blocks
  FOR ALL USING (public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Guests can view schedule_blocks" ON public.schedule_blocks
  FOR SELECT USING (public.is_event_guest(event_id, auth.uid()));

-- Notification schedules
DROP POLICY IF EXISTS "Host can manage notification_schedules" ON public.notification_schedules;
CREATE POLICY "Host can manage notification_schedules" ON public.notification_schedules
  FOR ALL USING (public.is_event_host(event_id, auth.uid()));

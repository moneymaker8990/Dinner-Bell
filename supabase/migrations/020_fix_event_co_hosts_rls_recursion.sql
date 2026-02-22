-- Fix 500 on event_co_hosts: RLS policy used is_event_host which triggers events SELECT
-- which uses is_event_host_or_co_host which reads event_co_hosts -> infinite recursion.
-- Use a SECURITY DEFINER helper that bypasses RLS so the policy does not re-enter event_co_hosts.

CREATE OR REPLACE FUNCTION public.can_view_event_co_hosts(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND host_user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = p_event_id AND user_id = p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.can_view_event_co_hosts(UUID, UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "Guests can view co_hosts for their events" ON public.event_co_hosts;
CREATE POLICY "Guests can view co_hosts for their events" ON public.event_co_hosts
  FOR SELECT USING (public.can_view_event_co_hosts(event_id, auth.uid()));

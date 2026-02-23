-- Allow signed-in users and anon invite visitors to discover public events.
-- This policy only grants SELECT when event is explicitly public and not cancelled.

DROP POLICY IF EXISTS "Anyone can view public events" ON public.events;
CREATE POLICY "Anyone can view public events" ON public.events
  FOR SELECT
  USING (is_public = true AND is_cancelled = false);

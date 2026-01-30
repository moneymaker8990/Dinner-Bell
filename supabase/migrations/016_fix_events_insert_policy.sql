-- Fix: Allow users to create (INSERT) events as host. The host/co-host policy (013) uses
-- is_event_host_or_co_host(id, auth.uid()) which fails for INSERT (row doesn't exist yet).
-- Migration 017 splits that into SELECT/UPDATE/DELETE only, so INSERT is governed only by this policy.
DROP POLICY IF EXISTS "Users can create events as host" ON public.events;
CREATE POLICY "Users can create events as host" ON public.events
  FOR INSERT
  WITH CHECK (host_user_id = auth.uid());

-- Fix: Allow users to create (INSERT) events as host. The "Host or co-host can manage events"
-- policy uses is_event_host_or_co_host(id, auth.uid()) which looks up the row - for INSERT
-- the row does not exist yet, so the policy denies creation.
CREATE POLICY "Users can create events as host" ON public.events
  FOR INSERT
  WITH CHECK (host_user_id = auth.uid());

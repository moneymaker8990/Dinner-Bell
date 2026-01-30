-- Ensure INSERT is only governed by "Users can create events as host".
-- Split "Host or co-host can manage events" (FOR ALL) into SELECT/UPDATE/DELETE only,
-- so no FOR ALL policy runs WITH CHECK on INSERT (which would fail for new rows).
DROP POLICY IF EXISTS "Host or co-host can manage events" ON public.events;
CREATE POLICY "Host or co-host can select events" ON public.events
  FOR SELECT USING (public.is_event_host_or_co_host(id, auth.uid()));
CREATE POLICY "Host or co-host can update events" ON public.events
  FOR UPDATE USING (public.is_event_host_or_co_host(id, auth.uid())) WITH CHECK (public.is_event_host_or_co_host(id, auth.uid()));
CREATE POLICY "Host or co-host can delete events" ON public.events
  FOR DELETE USING (public.is_event_host_or_co_host(id, auth.uid()));
-- INSERT is already allowed by 016: "Users can create events as host" FOR INSERT WITH CHECK (host_user_id = auth.uid())

-- Phase 4a: Host power tools – co-hosts can manage, waitlist, prep tasks

-- Helper: host or co-host can manage event (edit menu, bring, ring bell, etc.)
CREATE OR REPLACE FUNCTION public.is_event_host_or_co_host(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_event_host(p_event_id, p_user_id)
     OR EXISTS (SELECT 1 FROM public.event_co_hosts WHERE event_id = p_event_id AND user_id = p_user_id);
$$;
GRANT EXECUTE ON FUNCTION public.is_event_host_or_co_host(UUID, UUID) TO anon, authenticated;

-- Events: allow co-hosts to update (same as host for edit)
DROP POLICY IF EXISTS "Host can do all on own events" ON public.events;
CREATE POLICY "Host or co-host can manage events" ON public.events
  FOR ALL USING (public.is_event_host_or_co_host(id, auth.uid()));

-- Allow guests to still view (existing policy)
-- Host/manage policies for child tables: allow co-hosts
DROP POLICY IF EXISTS "Host can manage event guests" ON public.event_guests;
CREATE POLICY "Host or co-host can manage event_guests" ON public.event_guests
  FOR ALL USING (public.is_event_host_or_co_host(event_id, auth.uid()));

DROP POLICY IF EXISTS "Host can manage menu_sections" ON public.menu_sections;
CREATE POLICY "Host or co-host can manage menu_sections" ON public.menu_sections
  FOR ALL USING (public.is_event_host_or_co_host(event_id, auth.uid()));

DROP POLICY IF EXISTS "Host can manage menu_items" ON public.menu_items;
CREATE POLICY "Host or co-host can manage menu_items" ON public.menu_items
  FOR ALL USING (public.is_event_host_or_co_host(event_id, auth.uid()));

DROP POLICY IF EXISTS "Host can manage bring_items" ON public.bring_items;
CREATE POLICY "Host or co-host can manage bring_items" ON public.bring_items
  FOR ALL USING (public.is_event_host_or_co_host(event_id, auth.uid()));

DROP POLICY IF EXISTS "Host can manage schedule_blocks" ON public.schedule_blocks;
CREATE POLICY "Host or co-host can manage schedule_blocks" ON public.schedule_blocks
  FOR ALL USING (public.is_event_host_or_co_host(event_id, auth.uid()));

DROP POLICY IF EXISTS "Host can manage notification_schedules" ON public.notification_schedules;
CREATE POLICY "Host or co-host can manage notification_schedules" ON public.notification_schedules
  FOR ALL USING (public.is_event_host_or_co_host(event_id, auth.uid()));

-- Event waitlist (optional: when event at capacity)
CREATE TABLE IF NOT EXISTS public.event_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL DEFAULT 'email',
  contact_value TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, contact_value)
);
CREATE INDEX IF NOT EXISTS idx_event_waitlist_event_id ON public.event_waitlist(event_id);
ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Host or co-host manage waitlist" ON public.event_waitlist
  FOR ALL USING (public.is_event_host_or_co_host(event_id, auth.uid()));
CREATE POLICY "Anyone can join waitlist" ON public.event_waitlist
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Host or co-host can read waitlist" ON public.event_waitlist
  FOR SELECT USING (public.is_event_host_or_co_host(event_id, auth.uid()));

-- Prep tasks (host-only checklist; remind_at can trigger push via cron)
CREATE TABLE IF NOT EXISTS public.event_prep_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  remind_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_prep_tasks_event_id ON public.event_prep_tasks(event_id);
ALTER TABLE public.event_prep_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Host or co-host manage prep_tasks" ON public.event_prep_tasks
  FOR ALL USING (public.is_event_host_or_co_host(event_id, auth.uid()));

-- Resolve email to user_id for adding co-hosts (SECURITY DEFINER to read auth.users)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO authenticated;

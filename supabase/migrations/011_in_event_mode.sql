-- Phase 2d: In-Event Mode - event chat and quick polls
CREATE TABLE IF NOT EXISTS public.event_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_poll_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES public.event_polls(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES public.event_guests(id) ON DELETE CASCADE,
  option_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_event_messages_event_id ON public.event_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_event_polls_event_id ON public.event_polls(event_id);
CREATE INDEX IF NOT EXISTS idx_event_poll_votes_poll_id ON public.event_poll_votes(poll_id);

ALTER TABLE public.event_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event participants manage event_messages" ON public.event_messages
  FOR ALL USING (public.is_event_guest(event_id, auth.uid()) OR public.is_event_host(event_id, auth.uid()));

CREATE POLICY "Event participants manage event_polls" ON public.event_polls
  FOR ALL USING (public.is_event_guest(event_id, auth.uid()) OR public.is_event_host(event_id, auth.uid()));

CREATE POLICY "Event participants manage event_poll_votes" ON public.event_poll_votes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.event_polls p WHERE p.id = poll_id AND (public.is_event_guest(p.event_id, auth.uid()) OR public.is_event_host(p.event_id, auth.uid())))
  );

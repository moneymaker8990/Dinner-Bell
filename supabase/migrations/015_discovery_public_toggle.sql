-- Phase 4d: Optional public/visible events for future Discover
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_events_is_public ON public.events(is_public) WHERE is_public = true;

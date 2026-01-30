-- Phase 0: Foundation schema for premium features
-- profiles: avatar
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- arrival_status for event_guests (on_the_way, arrived)
DO $$ BEGIN
  CREATE TYPE arrival_status AS ENUM ('not_started', 'on_the_way', 'arrived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS arrival_status arrival_status NOT NULL DEFAULT 'not_started';
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS eta_minutes INT;

-- events: theme, capacity, bell_sound
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS theme_slug TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity INT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS bell_sound TEXT NOT NULL DEFAULT 'triangle';

-- Guest groups (saved contact lists for hosts)
CREATE TABLE IF NOT EXISTS public.guest_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guest_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.guest_groups(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL DEFAULT 'email',
  contact_value TEXT NOT NULL,
  display_name TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (group_id, contact_value)
);

CREATE INDEX IF NOT EXISTS idx_guest_groups_user_id ON public.guest_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_guest_group_members_group_id ON public.guest_group_members(group_id);

ALTER TABLE public.guest_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own guest_groups" ON public.guest_groups
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage guest_group_members of own groups" ON public.guest_group_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.guest_groups WHERE id = guest_group_members.group_id AND user_id = auth.uid())
  );

-- Event templates (Taco night, Potluck, etc.)
CREATE TABLE IF NOT EXISTS public.event_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  default_duration_min INT,
  default_bell_offset_min INT,
  menu_json JSONB,
  bring_json JSONB,
  theme_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_templates_slug ON public.event_templates(slug);

ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read event_templates" ON public.event_templates FOR SELECT USING (true);

-- Co-hosts
CREATE TABLE IF NOT EXISTS public.event_co_hosts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_co_hosts_event_id ON public.event_co_hosts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_co_hosts_user_id ON public.event_co_hosts(user_id);

ALTER TABLE public.event_co_hosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Host and co-hosts manage event_co_hosts" ON public.event_co_hosts
  FOR ALL USING (
    public.is_event_host(event_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.event_co_hosts c WHERE c.event_id = event_co_hosts.event_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Guests can view co_hosts for their events" ON public.event_co_hosts
  FOR SELECT USING (public.is_event_guest(event_id, auth.uid()) OR public.is_event_host(event_id, auth.uid()));

-- Event photos (recap)
CREATE TABLE IF NOT EXISTS public.event_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_photo_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_id UUID NOT NULL REFERENCES public.event_photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (photo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_photos_event_id ON public.event_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_event_photo_reactions_photo_id ON public.event_photo_reactions(photo_id);

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_photo_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event participants manage event_photos" ON public.event_photos
  FOR ALL USING (public.is_event_guest(event_id, auth.uid()) OR public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Event participants manage event_photo_reactions" ON public.event_photo_reactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.event_photos p WHERE p.id = photo_id AND (public.is_event_guest(p.event_id, auth.uid()) OR public.is_event_host(p.event_id, auth.uid())))
  );

-- Trigger updated_at for guest_groups
CREATE TRIGGER guest_groups_updated_at BEFORE UPDATE ON public.guest_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill status_updated_at from updated_at for existing rows
UPDATE public.event_guests SET status_updated_at = updated_at WHERE status_updated_at IS NULL;

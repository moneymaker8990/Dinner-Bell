-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- RSVP and bring item enums
CREATE TYPE rsvp_status AS ENUM ('going', 'maybe', 'cant');
CREATE TYPE bring_item_category AS ENUM ('drink', 'side', 'dessert', 'supplies', 'other');
CREATE TYPE bring_item_status AS ENUM ('unclaimed', 'claimed', 'provided');
CREATE TYPE notification_schedule_type AS ENUM ('reminder_30m', 'reminder_2h', 'bell');

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  bell_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  location_name TEXT,
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT,
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  location_notes TEXT,
  invite_token TEXT NOT NULL UNIQUE,
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event guests
CREATE TABLE public.event_guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_phone_or_email TEXT NOT NULL,
  rsvp_status rsvp_status NOT NULL DEFAULT 'going',
  wants_reminders BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, guest_phone_or_email)
);

CREATE INDEX idx_event_guests_event_id ON public.event_guests(event_id);
CREATE INDEX idx_event_guests_user_id ON public.event_guests(user_id);

-- Menu sections
CREATE TABLE public.menu_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_menu_sections_event_id ON public.menu_sections(event_id);

-- Menu items
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.menu_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  dietary_tags TEXT[],
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_menu_items_event_id ON public.menu_items(event_id);

-- Bring items
CREATE TABLE public.bring_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '1',
  category bring_item_category NOT NULL DEFAULT 'other',
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_claimable BOOLEAN NOT NULL DEFAULT true,
  claimed_by_guest_id UUID REFERENCES public.event_guests(id) ON DELETE SET NULL,
  claimed_quantity TEXT,
  status bring_item_status NOT NULL DEFAULT 'unclaimed',
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_bring_items_event_id ON public.bring_items(event_id);

-- Schedule blocks (after-dinner activities)
CREATE TABLE public.schedule_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  time TIMESTAMPTZ,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_schedule_blocks_event_id ON public.schedule_blocks(event_id);

-- Notification schedules (for server-driven reminders and bell)
CREATE TABLE public.notification_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  type notification_schedule_type NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_schedules_send ON public.notification_schedules(scheduled_at) WHERE sent_at IS NULL;

-- Trigger: create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bring_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Events: host full access; guests can select if they have event_guests row
CREATE POLICY "Host can do all on own events" ON public.events
  FOR ALL USING (auth.uid() = host_user_id);
CREATE POLICY "Guests can view events they are invited to" ON public.events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = events.id AND user_id = auth.uid())
  );

-- Event guests: host CRUD; guest can update own row and select event guests
CREATE POLICY "Host can manage event guests" ON public.event_guests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = event_guests.event_id AND host_user_id = auth.uid())
  );
CREATE POLICY "Guests can view event guests" ON public.event_guests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_guests eg WHERE eg.event_id = event_guests.event_id AND eg.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_guests.event_id AND host_user_id = auth.uid())
  );
CREATE POLICY "Guests can update own guest row" ON public.event_guests
  FOR UPDATE USING (user_id = auth.uid());

-- Allow insert for event_guests via invite (no auth required for anonymous RSVP - we use RPC)
-- We'll use a service role or RPC with invite_token check for anonymous guest insert

-- Menu sections: same as events (tied to event)
CREATE POLICY "Host can manage menu_sections" ON public.menu_sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = menu_sections.event_id AND host_user_id = auth.uid())
  );
CREATE POLICY "Guests can view menu_sections" ON public.menu_sections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = menu_sections.event_id AND user_id = auth.uid())
  );

-- Menu items: same
CREATE POLICY "Host can manage menu_items" ON public.menu_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = menu_items.event_id AND host_user_id = auth.uid())
  );
CREATE POLICY "Guests can view menu_items" ON public.menu_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = menu_items.event_id AND user_id = auth.uid())
  );

-- Bring items: host full; guests can view and update (claim) only claimable fields
CREATE POLICY "Host can manage bring_items" ON public.bring_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = bring_items.event_id AND host_user_id = auth.uid())
  );
CREATE POLICY "Guests can view bring_items" ON public.bring_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = bring_items.event_id AND user_id = auth.uid())
  );
CREATE POLICY "Guests can claim bring_items" ON public.bring_items
  FOR UPDATE USING (
    is_claimable AND EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = bring_items.event_id AND user_id = auth.uid())
  );

-- Schedule blocks: same as events
CREATE POLICY "Host can manage schedule_blocks" ON public.schedule_blocks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = schedule_blocks.event_id AND host_user_id = auth.uid())
  );
CREATE POLICY "Guests can view schedule_blocks" ON public.schedule_blocks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = schedule_blocks.event_id AND user_id = auth.uid())
  );

-- Notification schedules: only service role or host for cron; restrict read to host
CREATE POLICY "Host can manage notification_schedules" ON public.notification_schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.events WHERE id = notification_schedules.event_id AND host_user_id = auth.uid())
  );

-- RPC: get event by invite token (for unauthenticated guest access)
CREATE OR REPLACE FUNCTION public.get_event_by_invite(p_event_id UUID, p_token TEXT)
RETURNS TABLE (
  id UUID,
  host_user_id UUID,
  title TEXT,
  description TEXT,
  start_time TIMESTAMPTZ,
  bell_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  timezone TEXT,
  location_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  location_notes TEXT,
  is_cancelled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.host_user_id, e.title, e.description, e.start_time, e.bell_time, e.end_time,
         e.timezone, e.location_name, e.address_line1, e.address_line2, e.city, e.state,
         e.postal_code, e.country, e.location_notes, e.is_cancelled
  FROM public.events e
  WHERE e.id = p_event_id AND e.invite_token = p_token AND e.is_cancelled = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: add guest via invite (anonymous RSVP)
CREATE OR REPLACE FUNCTION public.add_guest_by_invite(
  p_event_id UUID,
  p_token TEXT,
  p_guest_name TEXT,
  p_guest_phone_or_email TEXT,
  p_rsvp_status rsvp_status DEFAULT 'going',
  p_wants_reminders BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  v_guest_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND invite_token = p_token AND is_cancelled = false) THEN
    RAISE EXCEPTION 'Invalid invite';
  END IF;
  INSERT INTO public.event_guests (event_id, guest_name, guest_phone_or_email, rsvp_status, wants_reminders, user_id)
  VALUES (p_event_id, p_guest_name, p_guest_phone_or_email, p_rsvp_status, p_wants_reminders, auth.uid())
  ON CONFLICT (event_id, guest_phone_or_email) DO UPDATE SET
    guest_name = EXCLUDED.guest_name,
    rsvp_status = EXCLUDED.rsvp_status,
    wants_reminders = EXCLUDED.wants_reminders,
    user_id = COALESCE(EXCLUDED.user_id, event_guests.user_id),
    updated_at = now()
  RETURNING event_guests.id INTO v_guest_id;
  RETURN v_guest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: claim bring item (by guest_id from event_guests)
CREATE OR REPLACE FUNCTION public.claim_bring_item(
  p_bring_item_id UUID,
  p_guest_id UUID,
  p_claimed_quantity TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_event_id UUID;
  v_claimable BOOLEAN;
  v_current_status bring_item_status;
BEGIN
  SELECT bi.event_id, bi.is_claimable, bi.status INTO v_event_id, v_claimable, v_current_status
  FROM public.bring_items bi
  WHERE bi.id = p_bring_item_id;
  IF v_event_id IS NULL THEN RETURN false; END IF;
  IF NOT v_claimable THEN RETURN false; END IF;
  IF v_current_status != 'unclaimed' THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_guests WHERE id = p_guest_id AND event_id = v_event_id) THEN
    RETURN false;
  END IF;
  UPDATE public.bring_items
  SET claimed_by_guest_id = p_guest_id, claimed_quantity = COALESCE(p_claimed_quantity, quantity), status = 'claimed', updated_at = now()
  WHERE id = p_bring_item_id AND status = 'unclaimed';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated_at trigger for events
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER event_guests_updated_at BEFORE UPDATE ON public.event_guests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allow anon to resolve invite and add guest (no account required)
GRANT EXECUTE ON FUNCTION public.get_event_by_invite(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.add_guest_by_invite(UUID, TEXT, TEXT, TEXT, rsvp_status, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.claim_bring_item(UUID, UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_event_by_invite(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_guest_by_invite(UUID, TEXT, TEXT, TEXT, rsvp_status, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bring_item(UUID, UUID, TEXT) TO authenticated;

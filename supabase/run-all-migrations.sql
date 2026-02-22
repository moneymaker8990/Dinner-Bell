-- Dinner Bell: run this entire file once in Supabase Dashboard → SQL Editor → New query
-- If you already ran some migrations, you may see "already exists" errors; that's OK.

-- ========== 001_initial.sql ==========
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE rsvp_status AS ENUM ('going', 'maybe', 'cant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE bring_item_category AS ENUM ('drink', 'side', 'dessert', 'supplies', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE bring_item_status AS ENUM ('unclaimed', 'claimed', 'provided');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE notification_schedule_type AS ENUM ('reminder_30m', 'reminder_2h', 'bell');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
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

CREATE TABLE IF NOT EXISTS public.event_guests (
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
CREATE INDEX IF NOT EXISTS idx_event_guests_event_id ON public.event_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_user_id ON public.event_guests(user_id);

CREATE TABLE IF NOT EXISTS public.menu_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_menu_sections_event_id ON public.menu_sections(event_id);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.menu_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  dietary_tags TEXT[],
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_menu_items_event_id ON public.menu_items(event_id);

CREATE TABLE IF NOT EXISTS public.bring_items (
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
CREATE INDEX IF NOT EXISTS idx_bring_items_event_id ON public.bring_items(event_id);

CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  time TIMESTAMPTZ,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_event_id ON public.schedule_blocks(event_id);

CREATE TABLE IF NOT EXISTS public.notification_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  type notification_schedule_type NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_schedules_send ON public.notification_schedules(scheduled_at) WHERE sent_at IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bring_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Host can do all on own events" ON public.events;
DROP POLICY IF EXISTS "Guests can view events they are invited to" ON public.events;
CREATE POLICY "Host can do all on own events" ON public.events FOR ALL USING (auth.uid() = host_user_id);
CREATE POLICY "Guests can view events they are invited to" ON public.events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = events.id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Host can manage event guests" ON public.event_guests;
DROP POLICY IF EXISTS "Guests can view event guests" ON public.event_guests;
DROP POLICY IF EXISTS "Guests can update own guest row" ON public.event_guests;
CREATE POLICY "Host can manage event guests" ON public.event_guests FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = event_guests.event_id AND host_user_id = auth.uid())
);
CREATE POLICY "Guests can view event guests" ON public.event_guests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.event_guests eg WHERE eg.event_id = event_guests.event_id AND eg.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.events WHERE id = event_guests.event_id AND host_user_id = auth.uid())
);
CREATE POLICY "Guests can update own guest row" ON public.event_guests FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Host can manage menu_sections" ON public.menu_sections;
DROP POLICY IF EXISTS "Guests can view menu_sections" ON public.menu_sections;
CREATE POLICY "Host can manage menu_sections" ON public.menu_sections FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = menu_sections.event_id AND host_user_id = auth.uid())
);
CREATE POLICY "Guests can view menu_sections" ON public.menu_sections FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = menu_sections.event_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Host can manage menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Guests can view menu_items" ON public.menu_items;
CREATE POLICY "Host can manage menu_items" ON public.menu_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = menu_items.event_id AND host_user_id = auth.uid())
);
CREATE POLICY "Guests can view menu_items" ON public.menu_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = menu_items.event_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Host can manage bring_items" ON public.bring_items;
DROP POLICY IF EXISTS "Guests can view bring_items" ON public.bring_items;
DROP POLICY IF EXISTS "Guests can claim bring_items" ON public.bring_items;
CREATE POLICY "Host can manage bring_items" ON public.bring_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = bring_items.event_id AND host_user_id = auth.uid())
);
CREATE POLICY "Guests can view bring_items" ON public.bring_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = bring_items.event_id AND user_id = auth.uid())
);
CREATE POLICY "Guests can claim bring_items" ON public.bring_items FOR UPDATE USING (
  is_claimable AND EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = bring_items.event_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Host can manage schedule_blocks" ON public.schedule_blocks;
DROP POLICY IF EXISTS "Guests can view schedule_blocks" ON public.schedule_blocks;
CREATE POLICY "Host can manage schedule_blocks" ON public.schedule_blocks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = schedule_blocks.event_id AND host_user_id = auth.uid())
);
CREATE POLICY "Guests can view schedule_blocks" ON public.schedule_blocks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = schedule_blocks.event_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Host can manage notification_schedules" ON public.notification_schedules;
CREATE POLICY "Host can manage notification_schedules" ON public.notification_schedules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE id = notification_schedules.event_id AND host_user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.get_event_by_invite(p_event_id UUID, p_token TEXT)
RETURNS TABLE (
  id UUID, host_user_id UUID, title TEXT, description TEXT, start_time TIMESTAMPTZ, bell_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ, timezone TEXT, location_name TEXT, address_line1 TEXT, address_line2 TEXT,
  city TEXT, state TEXT, postal_code TEXT, country TEXT, location_notes TEXT, is_cancelled BOOLEAN
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

CREATE OR REPLACE FUNCTION public.add_guest_by_invite(
  p_event_id UUID, p_token TEXT, p_guest_name TEXT, p_guest_phone_or_email TEXT,
  p_rsvp_status rsvp_status DEFAULT 'going', p_wants_reminders BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE v_guest_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND invite_token = p_token AND is_cancelled = false) THEN
    RAISE EXCEPTION 'Invalid invite';
  END IF;
  INSERT INTO public.event_guests (event_id, guest_name, guest_phone_or_email, rsvp_status, wants_reminders, user_id)
  VALUES (p_event_id, p_guest_name, p_guest_phone_or_email, p_rsvp_status, p_wants_reminders, auth.uid())
  ON CONFLICT (event_id, guest_phone_or_email) DO UPDATE SET
    guest_name = EXCLUDED.guest_name, rsvp_status = EXCLUDED.rsvp_status, wants_reminders = EXCLUDED.wants_reminders,
    user_id = COALESCE(EXCLUDED.user_id, event_guests.user_id), updated_at = now()
  RETURNING event_guests.id INTO v_guest_id;
  RETURN v_guest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.claim_bring_item(
  p_bring_item_id UUID, p_guest_id UUID, p_claimed_quantity TEXT DEFAULT NULL, p_claim_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE v_event_id UUID; v_claimable BOOLEAN; v_current_status bring_item_status;
BEGIN
  SELECT bi.event_id, bi.is_claimable, bi.status INTO v_event_id, v_claimable, v_current_status
  FROM public.bring_items bi WHERE bi.id = p_bring_item_id;
  IF v_event_id IS NULL THEN RETURN false; END IF;
  IF NOT v_claimable THEN RETURN false; END IF;
  IF v_current_status != 'unclaimed' THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_guests WHERE id = p_guest_id AND event_id = v_event_id) THEN RETURN false; END IF;
  UPDATE public.bring_items
  SET claimed_by_guest_id = p_guest_id, claimed_quantity = COALESCE(p_claimed_quantity, quantity),
      claim_message = p_claim_message, status = 'claimed', updated_at = now()
  WHERE id = p_bring_item_id AND status = 'unclaimed';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
DROP TRIGGER IF EXISTS event_guests_updated_at ON public.event_guests;
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER event_guests_updated_at BEFORE UPDATE ON public.event_guests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT EXECUTE ON FUNCTION public.get_event_by_invite(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_guest_by_invite(UUID, TEXT, TEXT, TEXT, rsvp_status, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bring_item(UUID, UUID, TEXT, TEXT) TO anon, authenticated;

-- ========== 002_get_event_by_guest.sql ==========
CREATE OR REPLACE FUNCTION public.get_event_by_guest_id(p_event_id UUID, p_guest_id UUID)
RETURNS SETOF public.events LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT e.* FROM public.events e
  JOIN public.event_guests g ON g.event_id = e.id AND g.id = p_guest_id
  WHERE e.id = p_event_id AND e.is_cancelled = false;
$$;

CREATE OR REPLACE FUNCTION public.get_event_full_for_guest(p_event_id UUID, p_guest_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event RECORD; v_sections JSON; v_items JSON; v_bring JSON; v_blocks JSON; v_guests JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.event_guests WHERE id = p_guest_id AND event_id = p_event_id) THEN RETURN NULL; END IF;
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND is_cancelled = false;
  IF v_event.id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(json_agg(row_to_json(ms) ORDER BY sort_order), '[]') INTO v_sections FROM (SELECT * FROM public.menu_sections WHERE event_id = p_event_id) ms;
  SELECT COALESCE(json_agg(row_to_json(mi) ORDER BY sort_order), '[]') INTO v_items FROM (SELECT * FROM public.menu_items WHERE event_id = p_event_id) mi;
  SELECT COALESCE(json_agg(row_to_json(bi) ORDER BY sort_order), '[]') INTO v_bring FROM (SELECT * FROM public.bring_items WHERE event_id = p_event_id) bi;
  SELECT COALESCE(json_agg(row_to_json(sb) ORDER BY sort_order), '[]') INTO v_blocks FROM (SELECT * FROM public.schedule_blocks WHERE event_id = p_event_id) sb;
  SELECT COALESCE(json_agg(row_to_json(eg)), '[]') INTO v_guests FROM (SELECT id, guest_name, rsvp_status FROM public.event_guests WHERE event_id = p_event_id) eg;
  RETURN json_build_object('event', row_to_json(v_event), 'menu_sections', v_sections, 'menu_items', v_items, 'bring_items', v_bring, 'schedule_blocks', v_blocks, 'guests', v_guests);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_by_guest_id(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_full_for_guest(UUID, UUID) TO anon, authenticated;

-- ========== 003_invite_note.sql ==========
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS invite_note TEXT;

-- ========== 004_invite_preview.sql ==========
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_event_id UUID, p_token TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event RECORD; v_sections JSON; v_items JSON; v_bring JSON;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND invite_token = p_token AND is_cancelled = false;
  IF v_event.id IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(json_agg(row_to_json(ms) ORDER BY sort_order), '[]') INTO v_sections FROM (SELECT id, title, sort_order FROM public.menu_sections WHERE event_id = p_event_id) ms;
  SELECT COALESCE(json_agg(row_to_json(mi) ORDER BY sort_order), '[]') INTO v_items FROM (SELECT id, section_id, name, notes, dietary_tags, sort_order FROM public.menu_items WHERE event_id = p_event_id) mi;
  SELECT COALESCE(json_agg(row_to_json(bi) ORDER BY sort_order), '[]') INTO v_bring FROM (SELECT id, name, quantity, category, is_required, is_claimable, sort_order FROM public.bring_items WHERE event_id = p_event_id) bi;
  RETURN json_build_object('event', row_to_json(v_event), 'menu_sections', v_sections, 'menu_items', v_items, 'bring_items', v_bring);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(UUID, TEXT) TO anon, authenticated;

-- ========== 005_claim_message.sql (column + function already in 001 block above with 4-arg claim_bring_item) ==========
ALTER TABLE public.bring_items ADD COLUMN IF NOT EXISTS claim_message TEXT;

-- ========== 006_add_guest_by_host.sql ==========
CREATE OR REPLACE FUNCTION public.add_guest_by_host(p_event_id UUID, p_guest_email TEXT, p_guest_name TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE v_guest_id UUID; v_user_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND host_user_id = auth.uid() AND is_cancelled = false) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT id INTO v_user_id FROM public.profiles WHERE email = trim(lower(p_guest_email)) LIMIT 1;
  INSERT INTO public.event_guests (event_id, guest_name, guest_phone_or_email, rsvp_status, wants_reminders, user_id)
  VALUES (p_event_id, COALESCE(NULLIF(trim(p_guest_name), ''), split_part(trim(p_guest_email), '@', 1)), trim(p_guest_email), 'going', true, v_user_id)
  ON CONFLICT (event_id, guest_phone_or_email) DO UPDATE SET guest_name = COALESCE(EXCLUDED.guest_name, event_guests.guest_name), user_id = COALESCE(EXCLUDED.user_id, event_guests.user_id), updated_at = now()
  RETURNING id INTO v_guest_id;
  RETURN v_guest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.add_guest_by_host(UUID, TEXT, TEXT) TO authenticated;

-- ========== 007_fix_rls_recursion.sql ==========
-- Fix: "infinite recursion detected in policy for relation events"
CREATE OR REPLACE FUNCTION public.is_event_host(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND host_user_id = p_user_id);
$$;
CREATE OR REPLACE FUNCTION public.is_event_guest(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_guests WHERE event_id = p_event_id AND user_id = p_user_id);
$$;
GRANT EXECUTE ON FUNCTION public.is_event_host(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_guest(UUID, UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "Guests can view events they are invited to" ON public.events;
CREATE POLICY "Guests can view events they are invited to" ON public.events FOR SELECT USING (public.is_event_guest(id, auth.uid()));

DROP POLICY IF EXISTS "Host can manage event guests" ON public.event_guests;
DROP POLICY IF EXISTS "Guests can view event guests" ON public.event_guests;
CREATE POLICY "Host can manage event guests" ON public.event_guests FOR ALL USING (public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Guests can view event guests" ON public.event_guests FOR SELECT USING (
  public.is_event_guest(event_id, auth.uid()) OR public.is_event_host(event_id, auth.uid())
);

DROP POLICY IF EXISTS "Host can manage menu_sections" ON public.menu_sections;
DROP POLICY IF EXISTS "Guests can view menu_sections" ON public.menu_sections;
CREATE POLICY "Host can manage menu_sections" ON public.menu_sections FOR ALL USING (public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Guests can view menu_sections" ON public.menu_sections FOR SELECT USING (public.is_event_guest(event_id, auth.uid()));

DROP POLICY IF EXISTS "Host can manage menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Guests can view menu_items" ON public.menu_items;
CREATE POLICY "Host can manage menu_items" ON public.menu_items FOR ALL USING (public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Guests can view menu_items" ON public.menu_items FOR SELECT USING (public.is_event_guest(event_id, auth.uid()));

DROP POLICY IF EXISTS "Host can manage bring_items" ON public.bring_items;
DROP POLICY IF EXISTS "Guests can view bring_items" ON public.bring_items;
DROP POLICY IF EXISTS "Guests can claim bring_items" ON public.bring_items;
CREATE POLICY "Host can manage bring_items" ON public.bring_items FOR ALL USING (public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Guests can view bring_items" ON public.bring_items FOR SELECT USING (public.is_event_guest(event_id, auth.uid()));
CREATE POLICY "Guests can claim bring_items" ON public.bring_items FOR UPDATE USING (
  is_claimable AND public.is_event_guest(event_id, auth.uid())
);

DROP POLICY IF EXISTS "Host can manage schedule_blocks" ON public.schedule_blocks;
DROP POLICY IF EXISTS "Guests can view schedule_blocks" ON public.schedule_blocks;
CREATE POLICY "Host can manage schedule_blocks" ON public.schedule_blocks FOR ALL USING (public.is_event_host(event_id, auth.uid()));
CREATE POLICY "Guests can view schedule_blocks" ON public.schedule_blocks FOR SELECT USING (public.is_event_guest(event_id, auth.uid()));

DROP POLICY IF EXISTS "Host can manage notification_schedules" ON public.notification_schedules;
CREATE POLICY "Host can manage notification_schedules" ON public.notification_schedules FOR ALL USING (public.is_event_host(event_id, auth.uid()));

-- ========== 008_add_guest_by_phone.sql ==========
CREATE OR REPLACE FUNCTION public.add_guest_by_host_phone(p_event_id UUID, p_guest_phone TEXT, p_guest_name TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  v_guest_id UUID;
  v_user_id UUID;
  v_normalized TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id AND host_user_id = auth.uid() AND is_cancelled = false) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_normalized := regexp_replace(p_guest_phone, '[^0-9]', '', 'g');
  IF length(v_normalized) < 10 THEN
    RAISE EXCEPTION 'Invalid phone number';
  END IF;
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_normalized
  LIMIT 1;
  INSERT INTO public.event_guests (event_id, guest_name, guest_phone_or_email, rsvp_status, wants_reminders, user_id)
  VALUES (p_event_id, COALESCE(NULLIF(trim(p_guest_name), ''), 'Guest'), v_normalized, 'going', true, v_user_id)
  ON CONFLICT (event_id, guest_phone_or_email) DO UPDATE SET
    guest_name = COALESCE(EXCLUDED.guest_name, event_guests.guest_name),
    user_id = COALESCE(EXCLUDED.user_id, event_guests.user_id),
    updated_at = now()
  RETURNING id INTO v_guest_id;
  RETURN v_guest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.add_guest_by_host_phone(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_push_token_by_phone(p_normalized_phone TEXT)
RETURNS TEXT AS $$
  SELECT push_token FROM public.profiles
  WHERE push_token IS NOT NULL AND length(regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g')) > 0
    AND regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g') = p_normalized_phone
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
GRANT EXECUTE ON FUNCTION public.get_push_token_by_phone(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_push_token_by_phone(TEXT) TO authenticated;

-- ========== 009_premium_foundation.sql ==========
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

DO $$ BEGIN
  CREATE TYPE arrival_status AS ENUM ('not_started', 'on_the_way', 'arrived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS arrival_status arrival_status NOT NULL DEFAULT 'not_started';
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE public.event_guests ADD COLUMN IF NOT EXISTS eta_minutes INT;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS theme_slug TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity INT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS bell_sound TEXT NOT NULL DEFAULT 'triangle';

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

DROP POLICY IF EXISTS "Users manage own guest_groups" ON public.guest_groups;
CREATE POLICY "Users manage own guest_groups" ON public.guest_groups FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage guest_group_members of own groups" ON public.guest_group_members;
CREATE POLICY "Users manage guest_group_members of own groups" ON public.guest_group_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.guest_groups WHERE id = guest_group_members.group_id AND user_id = auth.uid())
);

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
DROP POLICY IF EXISTS "Anyone can read event_templates" ON public.event_templates;
CREATE POLICY "Anyone can read event_templates" ON public.event_templates FOR SELECT USING (true);

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
DROP POLICY IF EXISTS "Host and co-hosts manage event_co_hosts" ON public.event_co_hosts;
CREATE POLICY "Host and co-hosts manage event_co_hosts" ON public.event_co_hosts FOR ALL USING (
  public.is_event_host(event_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.event_co_hosts c WHERE c.event_id = event_co_hosts.event_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Guests can view co_hosts for their events" ON public.event_co_hosts;
CREATE POLICY "Guests can view co_hosts for their events" ON public.event_co_hosts FOR SELECT USING (public.is_event_guest(event_id, auth.uid()) OR public.is_event_host(event_id, auth.uid()));

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

DROP POLICY IF EXISTS "Event participants manage event_photos" ON public.event_photos;
CREATE POLICY "Event participants manage event_photos" ON public.event_photos FOR ALL USING (public.is_event_guest(event_id, auth.uid()) OR public.is_event_host(event_id, auth.uid()));
DROP POLICY IF EXISTS "Event participants manage event_photo_reactions" ON public.event_photo_reactions;
CREATE POLICY "Event participants manage event_photo_reactions" ON public.event_photo_reactions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.event_photos p WHERE p.id = photo_id AND (public.is_event_guest(p.event_id, auth.uid()) OR public.is_event_host(p.event_id, auth.uid())))
);

DROP TRIGGER IF EXISTS guest_groups_updated_at ON public.guest_groups;
CREATE TRIGGER guest_groups_updated_at BEFORE UPDATE ON public.guest_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

UPDATE public.event_guests SET status_updated_at = updated_at WHERE status_updated_at IS NULL;

-- ========== 010_phase1_invite_presence.sql ==========
DO $$ BEGIN
  ALTER TYPE rsvp_status ADD VALUE 'late';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.get_invite_preview(p_event_id UUID, p_token TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event RECORD; v_host_name TEXT; v_sections JSON; v_items JSON; v_bring JSON;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND invite_token = p_token AND is_cancelled = false;
  IF v_event.id IS NULL THEN RETURN NULL; END IF;
  SELECT name INTO v_host_name FROM public.profiles WHERE id = v_event.host_user_id;
  SELECT COALESCE(json_agg(row_to_json(ms) ORDER BY sort_order), '[]') INTO v_sections FROM (SELECT id, title, sort_order FROM public.menu_sections WHERE event_id = p_event_id) ms;
  SELECT COALESCE(json_agg(row_to_json(mi) ORDER BY sort_order), '[]') INTO v_items FROM (SELECT id, section_id, name, notes, dietary_tags, sort_order FROM public.menu_items WHERE event_id = p_event_id) mi;
  SELECT COALESCE(json_agg(row_to_json(bi) ORDER BY sort_order), '[]') INTO v_bring FROM (SELECT id, name, quantity, category, is_required, is_claimable, sort_order FROM public.bring_items WHERE event_id = p_event_id) bi;
  RETURN json_build_object('event', row_to_json(v_event), 'host_name', v_host_name, 'menu_sections', v_sections, 'menu_items', v_items, 'bring_items', v_bring);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_guest_status_updated_at()
RETURNS TRIGGER AS $$ BEGIN
  IF OLD.rsvp_status IS DISTINCT FROM NEW.rsvp_status THEN NEW.status_updated_at = now(); END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_guests_rsvp_updated ON public.event_guests;
CREATE TRIGGER event_guests_rsvp_updated BEFORE UPDATE ON public.event_guests FOR EACH ROW EXECUTE FUNCTION public.set_guest_status_updated_at();

-- ========== 011_in_event_mode.sql ==========
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
DROP POLICY IF EXISTS "Event participants manage event_messages" ON public.event_messages;
CREATE POLICY "Event participants manage event_messages" ON public.event_messages FOR ALL USING (public.is_event_guest(event_id, auth.uid()) OR public.is_event_host(event_id, auth.uid()));
DROP POLICY IF EXISTS "Event participants manage event_polls" ON public.event_polls;
CREATE POLICY "Event participants manage event_polls" ON public.event_polls FOR ALL USING (public.is_event_guest(event_id, auth.uid()) OR public.is_event_host(event_id, auth.uid()));
DROP POLICY IF EXISTS "Event participants manage event_poll_votes" ON public.event_poll_votes;
CREATE POLICY "Event participants manage event_poll_votes" ON public.event_poll_votes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.event_polls p WHERE p.id = poll_id AND (public.is_event_guest(p.event_id, auth.uid()) OR public.is_event_host(p.event_id, auth.uid())))
);

-- ========== 012_event_templates_seed.sql ==========
INSERT INTO public.event_templates (slug, name, description, default_duration_min, default_bell_offset_min, menu_json, bring_json, theme_slug)
VALUES
  (
    'taco_night',
    'Taco night',
    'Classic taco night with all the fixings',
    120,
    15,
    '[{"title":"Tacos","items":[{"name":"Beef tacos","notes":"","dietaryTags":[]},{"name":"Chicken tacos","notes":"","dietaryTags":[]},{"name":"Veggie tacos","notes":"","dietaryTags":["vegetarian"]}]},{"title":"Sides","items":[{"name":"Rice","notes":"","dietaryTags":[]},{"name":"Beans","notes":"","dietaryTags":["vegan"]}]}]'::jsonb,
    '[{"name":"Tortillas","quantity":"1","category":"supplies","isRequired":true,"isClaimable":true,"notes":""},{"name":"Salsa","quantity":"1","category":"side","isRequired":false,"isClaimable":true,"notes":""},{"name":"Guacamole","quantity":"1","category":"side","isRequired":false,"isClaimable":true,"notes":""},{"name":"Drinks","quantity":"1","category":"drink","isRequired":true,"isClaimable":true,"notes":""}]'::jsonb,
    'taco_night'
  ),
  (
    'potluck',
    'Potluck',
    'Everyone brings a dish to share',
    180,
    0,
    '[{"title":"Potluck","items":[{"name":"Bring a dish to share","notes":"","dietaryTags":[]}]}]'::jsonb,
    '[{"name":"Main dish","quantity":"1","category":"other","isRequired":true,"isClaimable":true,"notes":""},{"name":"Side or salad","quantity":"1","category":"side","isRequired":false,"isClaimable":true,"notes":""},{"name":"Dessert","quantity":"1","category":"dessert","isRequired":false,"isClaimable":true,"notes":""},{"name":"Drinks","quantity":"1","category":"drink","isRequired":true,"isClaimable":true,"notes":""}]'::jsonb,
    'potluck'
  ),
  (
    'game_night',
    'Game night',
    'Dinner and games',
    180,
    30,
    '[{"title":"Dinner","items":[{"name":"Pizza or easy mains","notes":"","dietaryTags":[]}]},{"title":"Snacks","items":[{"name":"Chips and dip","notes":"","dietaryTags":[]}]}]'::jsonb,
    '[{"name":"Pizza","quantity":"1","category":"other","isRequired":false,"isClaimable":true,"notes":""},{"name":"Snacks","quantity":"1","category":"side","isRequired":false,"isClaimable":true,"notes":""},{"name":"Drinks","quantity":"1","category":"drink","isRequired":true,"isClaimable":true,"notes":""}]'::jsonb,
    'game_night'
  ),
  (
    'brunch',
    'Brunch',
    'Weekend brunch together',
    120,
    0,
    '[{"title":"Brunch","items":[{"name":"Eggs","notes":"","dietaryTags":[]},{"name":"Pastries","notes":"","dietaryTags":[]},{"name":"Fruit","notes":"","dietaryTags":["vegan"]}]}]'::jsonb,
    '[{"name":"Mimosas or juice","quantity":"1","category":"drink","isRequired":true,"isClaimable":true,"notes":""},{"name":"Pastries or bread","quantity":"1","category":"other","isRequired":false,"isClaimable":true,"notes":""},{"name":"Fruit","quantity":"1","category":"side","isRequired":false,"isClaimable":true,"notes":""}]'::jsonb,
    'brunch'
  )
ON CONFLICT (slug) DO NOTHING;

-- ========== 013_host_power_tools.sql ==========
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

DROP POLICY IF EXISTS "Host can do all on own events" ON public.events;
CREATE POLICY "Host or co-host can manage events" ON public.events
  FOR ALL USING (public.is_event_host_or_co_host(id, auth.uid()));

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

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO authenticated;

-- ========== 014_invite_preview_guest_count.sql ==========
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_event_id UUID, p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_host_name TEXT;
  v_guest_count INT;
  v_sections JSON;
  v_items JSON;
  v_bring JSON;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id AND invite_token = p_token AND is_cancelled = false;
  IF v_event.id IS NULL THEN RETURN NULL; END IF;
  SELECT name INTO v_host_name FROM public.profiles WHERE id = v_event.host_user_id;
  SELECT count(*)::int INTO v_guest_count FROM public.event_guests WHERE event_id = p_event_id;
  SELECT COALESCE(json_agg(row_to_json(ms) ORDER BY sort_order), '[]') INTO v_sections
  FROM (SELECT id, title, sort_order FROM public.menu_sections WHERE event_id = p_event_id) ms;
  SELECT COALESCE(json_agg(row_to_json(mi) ORDER BY sort_order), '[]') INTO v_items
  FROM (SELECT id, section_id, name, notes, dietary_tags, sort_order FROM public.menu_items WHERE event_id = p_event_id) mi;
  SELECT COALESCE(json_agg(row_to_json(bi) ORDER BY sort_order), '[]') INTO v_bring
  FROM (SELECT id, name, quantity, category, is_required, is_claimable, sort_order FROM public.bring_items WHERE event_id = p_event_id) bi;
  RETURN json_build_object(
    'event', row_to_json(v_event),
    'host_name', v_host_name,
    'guest_count', v_guest_count,
    'menu_sections', v_sections,
    'menu_items', v_items,
    'bring_items', v_bring
  );
END;
$$;

-- ========== 015_discovery_public_toggle.sql ==========
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_events_is_public ON public.events(is_public) WHERE is_public = true;

-- ========== 016_fix_events_insert_policy.sql ==========
DROP POLICY IF EXISTS "Users can create events as host" ON public.events;
CREATE POLICY "Users can create events as host" ON public.events
  FOR INSERT
  WITH CHECK (host_user_id = auth.uid());

-- ========== 017_events_insert_only_policy.sql ==========
DROP POLICY IF EXISTS "Host or co-host can manage events" ON public.events;
CREATE POLICY "Host or co-host can select events" ON public.events
  FOR SELECT USING (public.is_event_host_or_co_host(id, auth.uid()));
CREATE POLICY "Host or co-host can update events" ON public.events
  FOR UPDATE USING (public.is_event_host_or_co_host(id, auth.uid())) WITH CHECK (public.is_event_host_or_co_host(id, auth.uid()));
CREATE POLICY "Host or co-host can delete events" ON public.events
  FOR DELETE USING (public.is_event_host_or_co_host(id, auth.uid()));

-- ========== 018_create_event_rpc.sql ==========
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_event(
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_bell_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_timezone TEXT DEFAULT 'UTC',
  p_location_name TEXT DEFAULT NULL,
  p_address_line1 TEXT DEFAULT '',
  p_address_line2 TEXT DEFAULT NULL,
  p_city TEXT DEFAULT '',
  p_state TEXT DEFAULT '',
  p_postal_code TEXT DEFAULT '',
  p_country TEXT DEFAULT '',
  p_location_notes TEXT DEFAULT NULL,
  p_invite_note TEXT DEFAULT NULL,
  p_invite_token TEXT DEFAULT NULL,
  p_theme_slug TEXT DEFAULT NULL,
  p_accent_color TEXT DEFAULT NULL,
  p_capacity INT DEFAULT NULL,
  p_bell_sound TEXT DEFAULT 'triangle',
  p_is_public BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_token TEXT;
  v_event_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  -- Avoid hard dependency on gen_random_bytes; UUID text fallback is broadly available.
  v_token := COALESCE(NULLIF(trim(p_invite_token), ''), replace(gen_random_uuid()::text, '-', ''));
  INSERT INTO public.events (
    host_user_id, title, description, start_time, bell_time, end_time, timezone,
    location_name, address_line1, address_line2, city, state, postal_code, country,
    location_notes, invite_note, invite_token, is_cancelled,
    theme_slug, accent_color, capacity, bell_sound, is_public
  ) VALUES (
    v_user_id, p_title, p_description, COALESCE(p_start_time, now()), COALESCE(p_bell_time, now()),
    p_end_time, COALESCE(p_timezone, 'UTC'), p_location_name,
    COALESCE(p_address_line1, ''), p_address_line2, COALESCE(p_city, ''), COALESCE(p_state, ''),
    COALESCE(p_postal_code, ''), COALESCE(p_country, ''), p_location_notes, p_invite_note,
    v_token, false, p_theme_slug, p_accent_color, p_capacity, COALESCE(p_bell_sound, 'triangle'),
    COALESCE(p_is_public, false)
  )
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_event(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN) TO authenticated;

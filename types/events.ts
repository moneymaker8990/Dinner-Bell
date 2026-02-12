import type { ArrivalStatus, BringItemCategory, BringItemStatus, RsvpStatus } from './database';

export interface EventWithDetails {
  id: string;
  host_user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  bell_time: string;
  end_time: string | null;
  timezone: string;
  location_name: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  location_notes: string | null;
  invite_token: string;
  is_cancelled: boolean;
  theme_slug?: string | null;
  accent_color?: string | null;
  capacity?: number | null;
  bell_sound?: string;
  cover_image_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventGuest {
  id: string;
  event_id: string;
  user_id: string | null;
  guest_name: string;
  guest_phone_or_email: string;
  rsvp_status: RsvpStatus;
  wants_reminders: boolean;
  status_updated_at?: string | null;
  arrival_status?: ArrivalStatus;
  arrived_at?: string | null;
  eta_minutes?: number | null;
  created_at: string;
  updated_at: string;
}

export interface MenuSection {
  id: string;
  event_id: string;
  title: string;
  sort_order: number;
}

export interface MenuItemRow {
  id: string;
  event_id: string;
  section_id: string;
  name: string;
  notes: string | null;
  dietary_tags: string[] | null;
  sort_order: number;
}

export interface BringItemRow {
  id: string;
  event_id: string;
  name: string;
  quantity: string;
  category: BringItemCategory;
  is_required: boolean;
  is_claimable: boolean;
  claimed_by_guest_id: string | null;
  claimed_quantity: string | null;
  status: BringItemStatus;
  notes: string | null;
  sort_order: number;
}

export interface ScheduleBlockRow {
  id: string;
  event_id: string;
  title: string;
  time: string | null;
  notes: string | null;
  sort_order: number;
}

export interface EventWithRelations extends EventWithDetails {
  menu_sections?: (MenuSection & { menu_items: MenuItemRow[] })[];
  bring_items?: BringItemRow[];
  schedule_blocks?: ScheduleBlockRow[];
  event_guests?: EventGuest[];
}

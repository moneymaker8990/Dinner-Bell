export type RsvpStatus = 'going' | 'maybe' | 'cant' | 'late';
export type ArrivalStatus = 'not_started' | 'on_the_way' | 'arrived';
export type BringItemCategory = 'drink' | 'side' | 'dessert' | 'supplies' | 'other';
export type BringItemStatus = 'unclaimed' | 'claimed' | 'provided';
export type NotificationScheduleType = 'reminder_30m' | 'reminder_2h' | 'bell';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          phone: string | null;
          email: string | null;
          push_token: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      events: {
        Row: {
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
          theme_slug: string | null;
          accent_color: string | null;
          capacity: number | null;
          is_public: boolean;
          bell_sound: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
      };
      event_guests: {
        Row: {
          id: string;
          event_id: string;
          user_id: string | null;
          guest_name: string;
          guest_phone_or_email: string;
          rsvp_status: RsvpStatus;
          wants_reminders: boolean;
          status_updated_at: string | null;
          arrival_status: ArrivalStatus;
          arrived_at: string | null;
          eta_minutes: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_guests']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['event_guests']['Insert']>;
      };
      menu_sections: {
        Row: {
          id: string;
          event_id: string;
          title: string;
          sort_order: number;
        };
        Insert: Omit<Database['public']['Tables']['menu_sections']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['menu_sections']['Insert']>;
      };
      menu_items: {
        Row: {
          id: string;
          event_id: string;
          section_id: string;
          name: string;
          notes: string | null;
          dietary_tags: string[] | null;
          sort_order: number;
        };
        Insert: Omit<Database['public']['Tables']['menu_items']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['menu_items']['Insert']>;
      };
      bring_items: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['bring_items']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['bring_items']['Insert']>;
      };
      schedule_blocks: {
        Row: {
          id: string;
          event_id: string;
          title: string;
          time: string | null;
          notes: string | null;
          sort_order: number;
        };
        Insert: Omit<Database['public']['Tables']['schedule_blocks']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['schedule_blocks']['Insert']>;
      };
      notification_schedules: {
        Row: {
          id: string;
          event_id: string;
          scheduled_at: string;
          type: NotificationScheduleType;
          sent_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notification_schedules']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notification_schedules']['Insert']>;
      };
      guest_groups: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['guest_groups']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['guest_groups']['Insert']>;
      };
      guest_group_members: {
        Row: {
          id: string;
          group_id: string;
          contact_type: string;
          contact_value: string;
          display_name: string | null;
          sort_order: number;
        };
        Insert: Omit<Database['public']['Tables']['guest_group_members']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['guest_group_members']['Insert']>;
      };
      event_templates: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          default_duration_min: number | null;
          default_bell_offset_min: number | null;
          menu_json: unknown;
          bring_json: unknown;
          theme_slug: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_templates']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['event_templates']['Insert']>;
      };
      event_co_hosts: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_co_hosts']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['event_co_hosts']['Insert']>;
      };
      event_photos: {
        Row: {
          id: string;
          event_id: string;
          uploaded_by: string;
          url: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_photos']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['event_photos']['Insert']>;
      };
      event_photo_reactions: {
        Row: {
          id: string;
          photo_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_photo_reactions']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['event_photo_reactions']['Insert']>;
      };
      event_messages: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_messages']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['event_messages']['Insert']>;
      };
      event_polls: {
        Row: {
          id: string;
          event_id: string;
          created_by: string;
          question: string;
          options: unknown;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_polls']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['event_polls']['Insert']>;
      };
      event_poll_votes: {
        Row: {
          id: string;
          poll_id: string;
          guest_id: string;
          option_index: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_poll_votes']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['event_poll_votes']['Insert']>;
      };
      event_waitlist: {
        Row: {
          id: string;
          event_id: string;
          contact_type: string;
          contact_value: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_waitlist']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['event_waitlist']['Insert']>;
      };
      event_prep_tasks: {
        Row: {
          id: string;
          event_id: string;
          title: string;
          remind_at: string | null;
          completed_at: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['event_prep_tasks']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['event_prep_tasks']['Insert']>;
      };
    };
    Functions: {
      create_event: {
        Args: {
          p_title: string;
          p_description: string | null;
          p_start_time: string;
          p_bell_time: string;
          p_bell_sound: string;
          p_end_time: string | null;
          p_timezone: string;
          p_address_line1: string;
          p_address_line2: string | null;
          p_city: string;
          p_state: string;
          p_postal_code: string;
          p_country: string;
          p_location_name: string | null;
          p_location_notes: string | null;
          p_invite_note: string | null;
          p_invite_token: string;
          p_theme_slug: string | null;
          p_accent_color: string | null;
          p_capacity: number | null;
          p_is_public: boolean;
        };
        Returns: string;
      };
      get_event_full_for_guest: {
        Args: {
          p_event_id: string;
          p_user_id: string | null;
        };
        Returns: unknown;
      };
      get_user_id_by_email: {
        Args: {
          p_email: string;
        };
        Returns: string | null;
      };
      get_event_by_invite: {
        Args: {
          p_event_id: string;
          p_token: string;
        };
        Returns: unknown[];
      };
      get_invite_preview: {
        Args: {
          p_event_id: string;
          p_token: string;
        };
        Returns: unknown;
      };
      add_guest_by_invite: {
        Args: {
          p_event_id: string;
          p_token: string;
          p_guest_name: string;
          p_guest_phone_or_email: string;
          p_rsvp_status: RsvpStatus;
          p_wants_reminders: boolean;
        };
        Returns: string;
      };
      add_guest_by_host: {
        Args: {
          p_event_id: string;
          p_guest_email: string;
          p_guest_name: string | null;
        };
        Returns: string;
      };
      add_guest_by_host_phone: {
        Args: {
          p_event_id: string;
          p_guest_phone: string;
          p_guest_name: string | null;
        };
        Returns: string;
      };
      claim_bring_item: {
        Args: {
          p_bring_item_id: string;
          p_guest_id: string;
          p_claimed_quantity: string | null;
          p_claim_message: string | null;
        };
        Returns: boolean;
      };
      get_push_token_by_phone: {
        Args: {
          p_normalized_phone: string;
        };
        Returns: string | null;
      };
    };
  };
}

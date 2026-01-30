export type RsvpStatus = 'going' | 'maybe' | 'cant';
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
    };
  };
}

import { supabase } from '@/lib/supabase';

export interface EventTemplate {
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
}

/**
 * Theme contract: map template/seasonal slugs to accent token sets.
 * Values are design-system aligned (use with Colors for contrast).
 */
export const THEME_ACCENT: Record<string, string> = {
  taco_night: '#E67E22',
  potluck: '#27AE60',
  game_night: '#8E44AD',
  brunch: '#F39C12',
  dinner_party: '#C79A2B',
  birthday: '#8E44AD',
  holiday: '#D45A4E',
};

export async function fetchTemplates(): Promise<EventTemplate[]> {
  const { data, error } = await supabase.from('event_templates').select('*').order('slug');
  if (error) return [];
  return (data ?? []) as EventTemplate[];
}

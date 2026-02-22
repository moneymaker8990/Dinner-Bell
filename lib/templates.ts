import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/Theme';

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
  taco_night: theme.colors.accent,
  potluck: theme.colors.success,
  game_night: theme.colors.primary,
  brunch: theme.colors.accent,
  dinner_party: theme.colors.primary,
  birthday: theme.colors.primaryHover,
  holiday: theme.colors.danger,
};

export async function fetchTemplates(): Promise<EventTemplate[]> {
  const { data, error } = await supabase.from('event_templates').select('*').order('slug');
  if (error) return [];
  return (data ?? []) as EventTemplate[];
}

import { theme } from '@/constants/Theme';

function withAlpha(hexColor: string, alpha: number): string {
  const clean = hexColor.replace('#', '');
  if (clean.length !== 6) return hexColor;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const nightColors = {
  // Canonical tokens
  background: theme.colors.background,
  surface: theme.colors.surface,
  surface2: theme.colors.surface2,
  border: theme.colors.border,
  text: theme.colors.textPrimary,
  textPrimary: theme.colors.textPrimary,
  textSecondary: theme.colors.textSecondary,
  success: theme.colors.success,
  error: theme.colors.danger,
  warn: theme.colors.accent,
  overlay: theme.colors.overlay,

  // Legacy compatibility keys
  primaryBrand: theme.colors.primary,
  primaryBrandFaint: withAlpha(theme.colors.primary, 0.18),
  tint: theme.colors.primary,
  tintFaint: withAlpha(theme.colors.primary, 0.14),
  tintSoft: withAlpha(theme.colors.primary, 0.24),
  tintBorder: withAlpha(theme.colors.primary, 0.4),
  tintMuted: withAlpha(theme.colors.primary, 0.6),
  richNeutral: theme.colors.textPrimary,
  richNeutralMuted: theme.colors.textSecondary,
  pressed: theme.colors.primaryHover,
  disabled: withAlpha(theme.colors.textSecondary, 0.35),
  disabledText: withAlpha(theme.colors.textSecondary, 0.65),
  gradientStart: theme.colors.background,
  gradientEnd: theme.colors.background,
  gradientStartFaint: withAlpha(theme.colors.primary, 0.15),
  rsvpGoing: theme.colors.success,
  rsvpLate: theme.colors.accent,
  rsvpMaybe: theme.colors.textSecondary,
  rsvpCant: theme.colors.danger,
  bringClaimed: theme.colors.success,
  bringUnclaimed: theme.colors.textSecondary,
  bringConflict: theme.colors.danger,
  shadow: withAlpha(theme.colors.background, 1),
  card: theme.colors.surface,
  elevatedSurface: theme.colors.surface2,
  elevatedSurface2: theme.colors.surface2,
  inputBorder: theme.colors.border,
  tabIconDefault: theme.colors.textSecondary,
  tabIconSelected: theme.colors.primary,
  primaryButton: theme.colors.primary,
  primaryButtonText: theme.colors.textPrimary,
  secondaryText: theme.colors.textSecondary,
  accentSage: theme.colors.success,
  accentSageFaint: withAlpha(theme.colors.success, 0.24),
  accentSageBorder: withAlpha(theme.colors.success, 0.6),
  accentTomato: theme.colors.danger,
  accentTomatoFaint: withAlpha(theme.colors.danger, 0.2),
  tabBarBackground: theme.colors.background,
  tabBarBorder: theme.colors.border,
  placeholder: withAlpha(theme.colors.textSecondary, 0.8),
  borderStrong: withAlpha(theme.colors.border, 0.8),
  onGradient: theme.colors.textPrimary,
  onGradientMuted: withAlpha(theme.colors.textPrimary, 0.85),
  onOverlay: theme.colors.textPrimary,
  onOverlayMuted: withAlpha(theme.colors.textPrimary, 0.7),
  brandGold: theme.colors.accent,
  brandGoldFaint: withAlpha(theme.colors.accent, 0.2),
  brandSage: theme.colors.success,
  brandSageFaint: withAlpha(theme.colors.success, 0.2),
  brandAmber: theme.colors.accent,
  brandAmberFaint: withAlpha(theme.colors.accent, 0.2),
  categoryBlue: theme.colors.primary,
  categoryGreen: theme.colors.success,
  categoryAmber: theme.colors.accent,
  categoryNeutral: theme.colors.textSecondary,
  categoryMuted: withAlpha(theme.colors.textSecondary, 0.75),
  confetti: [
    theme.colors.accent,
    theme.colors.success,
    theme.colors.danger,
    theme.colors.primary,
    theme.colors.primaryHover,
    theme.colors.textPrimary,
  ],
} as const;

export default {
  light: nightColors,
  dark: nightColors,
};

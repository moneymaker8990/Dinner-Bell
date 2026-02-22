/**
 * Design tokens: theme (source of truth), spacing, radius, elevation, typography, borders.
 * No raw hex except in theme.colors.
 */
import { Platform, ViewStyle } from 'react-native';

export const theme = {
  colors: {
    background: '#0F1115',
    surface: '#161A22',
    surface2: '#1C2230',
    primary: '#5B7CFF',
    primaryHover: '#6D8CFF',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A4AE',
    border: '#242836',
    danger: '#FF5C5C',
    success: '#2FD67D',
    accent: '#FFB020',
    overlay: 'rgba(0,0,0,0.55)',
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 26,
    xxl: 34,
  },
  typography: {
    title: { fontSize: 28, fontWeight: '800' as const },
    subtitle: { fontSize: 18, fontWeight: '700' as const },
    body: { fontSize: 16, fontWeight: '500' as const },
    small: { fontSize: 13, fontWeight: '500' as const },
  },
  shadow: {
    card: '0px 10px 30px rgba(0,0,0,0.35)',
  },
} as const;

export type AppTheme = typeof theme;

/** 4pt base grid */
export const spacing = {
  xs: theme.spacing.xs,
  sm: theme.spacing.sm,
  md: theme.spacing.md,
  lg: theme.spacing.lg,
  xl: theme.spacing.xl,
  xxl: theme.spacing.xxl,
} as const;

/** Content max-width for web/PWA */
export const contentMaxWidth = 640;

export const radius = {
  xs: theme.radius.sm,
  sm: theme.radius.sm,
  md: theme.radius.md,
  card: theme.radius.lg,
  button: theme.radius.md,
  chip: 999,
  input: theme.radius.md,
  fab: theme.radius.xl + 6,
} as const;

/** Type ramp: display → micro-label with strict hierarchy */
export const typography = {
  display: theme.typography.title.fontSize + 6,
  title: theme.typography.title.fontSize,
  headline: theme.typography.subtitle.fontSize + 4,
  body: theme.typography.body.fontSize,
  meta: theme.typography.small.fontSize + 1,
  microLabel: theme.typography.small.fontSize - 1,
  hero: theme.typography.title.fontSize + 6,
  h1: theme.typography.title.fontSize,
  h2: theme.typography.subtitle.fontSize + 4,
  h3: theme.typography.subtitle.fontSize,
  caption: theme.typography.small.fontSize + 1,
  small: theme.typography.small.fontSize,
} as const;

/** Optical letter-spacing for headings and CTA labels */
export const letterSpacing = {
  display: 0,
  title: -0.5,
  subtitle: 0.3,
  headline: 0,
  body: 0,
  meta: 0,
  microLabel: 0.5,
  cta: 0.5,
} as const;

/** Border / stroke widths */
export const border = {
  hairline: 1,
  subtle: 1,
  medium: 2,
  focusRing: 2,
} as const;

/** Elevation specs (shadowColor comes from Colors.shadow when applying) */
const elevationSpec = {
  flat: {},
  raised: Platform.select<ViewStyle>({
    ios: {
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    android: { elevation: 3 },
    default: {},
  })!,
  floating: Platform.select<ViewStyle>({
    ios: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
    default: {},
  })!,
  modal: Platform.select<ViewStyle>({
    ios: {
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
    },
    android: { elevation: 8 },
    default: {},
  })!,
  spotlight: Platform.select<ViewStyle>({
    ios: {
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 32,
    },
    android: { elevation: 12 },
    default: {},
  })!,
} as const;

export const elevation = elevationSpec;

/** Returns elevation style with shadowColor; use Colors[scheme].shadow */
export function getElevation(
  level: keyof typeof elevationSpec,
  shadowColor: string
): ViewStyle {
  const spec = elevationSpec[level];
  if (Platform.OS === 'ios' && 'shadowRadius' in spec) {
    return { ...spec, shadowColor };
  }
  return spec;
}

/** Legacy named shadows (use getElevation + colors.shadow in new code) */
export const cardShadow = Platform.select({
  ios: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  android: { elevation: 3 },
  default: {},
});

export const cardShadowSubtle = Platform.select({
  ios: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  android: { elevation: 2 },
  default: {},
});

export const cardShadowHover = Platform.select({
  ios: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  android: { elevation: 6 },
  default: {},
});

/** Icon sizing and stroke consistency */
export const iconSize = {
  sm: 16,
  md: 22,
  lg: 28,
} as const;

/** Line-height scale (absolute px, matched to typography ramp) */
export const lineHeight = {
  small: 20,
  meta: 22,
  body: 24,
  headline: 28,
  title: 42,
} as const;

/** Font-weight tokens */
export const fontWeight = {
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

/** Font family tokens */
export const fontFamily = {
  display: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia',
  }) as string,
  body: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }) as string,
} as const;

/** Z-index scale for layering */
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  modal: 30,
  toast: 40,
  overlay: 50,
} as const;

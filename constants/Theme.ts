/**
 * Design tokens: spacing, radius, elevation, typography, borders, gradients.
 * Use with Colors for a single source of truth. No raw hex here.
 */
import { Platform, ViewStyle } from 'react-native';

/** 4pt base grid */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Content max-width for web/PWA */
export const contentMaxWidth = 640;

export const radius = {
  xs: 2,
  sm: 4,
  md: 6,
  card: 18,
  button: 15,
  chip: 999,
  input: 12,
  fab: 28,
} as const;

/** Type ramp: display → micro-label with strict hierarchy */
export const typography = {
  display: 40,
  title: 34,
  headline: 22,
  body: 16,
  meta: 14,
  microLabel: 12,
  hero: 40,
  h1: 34,
  h2: 22,
  h3: 18,
  caption: 14,
  small: 12,
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
  small: 20,     // microLabel / small text
  meta: 22,      // meta / caption text
  body: 24,      // body text
  headline: 28,  // headline / h2 text
  title: 42,     // title / display text
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

/** Gradient token definitions (colors from Colors; use with LinearGradient) */
export const gradients = {
  hero: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  cta: { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
  accentGlow: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
} as const;
/**
 * Design tokens: spacing, radius, shadow, typography.
 * Use with Colors for a single source of truth.
 */
import { Platform } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  card: 18,
  button: 15,
  chip: 999,
  input: 12,
} as const;

export const typography = {
  hero: 40,
  h1: 34,
  h2: 22,
  h3: 18,
  body: 16,
  caption: 14,
  small: 12,
} as const;

export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#6B645C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  android: {
    elevation: 3,
  },
  default: {},
});

export const cardShadowSubtle = Platform.select({
  ios: {
    shadowColor: '#6B645C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  android: {
    elevation: 2,
  },
  default: {},
});

export const cardShadowHover = Platform.select({
  ios: {
    shadowColor: '#6B645C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  android: {
    elevation: 6,
  },
  default: {},
});

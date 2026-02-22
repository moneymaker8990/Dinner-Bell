/**
 * Tiered semantic colors: single source of truth for all UI color.
 * Light/dark parity; no raw hex outside this file.
 */

// Brand & neutrals
const tintColorLight = '#B8860B';
const tintColorDark = '#E8C547';
const honeyGold = '#C79A2B';
const sageGreen = '#4F7D6A';
const tomato = '#D45A4E';

// Shadow color for elevation (used with Theme elevation tokens)
const shadowLight = '#6B645C';
const shadowDark = '#1B1B1B';

export default {
  light: {
    // Primary brand
    primaryBrand: honeyGold,
    tint: honeyGold,
    primaryBrandFaint: 'rgba(199,154,43,0.16)',
    tintFaint: 'rgba(199,154,43,0.14)',
    tintSoft: 'rgba(199,154,43,0.24)',
    tintBorder: 'rgba(199,154,43,0.40)',
    tintMuted: 'rgba(199,154,43,0.60)',
    // Elevated surfaces
    surface: '#FAF6F0',
    surface2: '#F8F4EE',
    elevatedSurface: '#FFFBF5',
    elevatedSurface2: '#FAF6F0',
    // Rich neutrals
    text: '#1B1B1B',
    textPrimary: '#1B1B1B',
    textSecondary: '#6B645C',
    richNeutral: '#1B1B1B',
    richNeutralMuted: '#6B645C',
    // Semantic
    success: sageGreen,
    warn: '#B8860B',
    error: tomato,
    info: '#4A90C4',
    // Interactive states
    pressed: '#A87E1F',
    disabled: '#D4C9B8',
    disabledText: '#9A8F7E',
    // Gradient hero
    gradientStart: '#C79A2B',
    gradientEnd: '#4F7D6A',
    gradientStartFaint: 'rgba(199,154,43,0.15)',
    // RSVP accents
    rsvpGoing: sageGreen,
    rsvpLate: '#E8C547',
    rsvpMaybe: '#9A8F7E',
    rsvpCant: tomato,
    // Bring list
    bringClaimed: sageGreen,
    bringUnclaimed: '#6B645C',
    bringConflict: tomato,
    // Elevation
    shadow: shadowLight,
    // Legacy / layout
    background: '#F2EDE6',
    card: '#FFFBF5',
    inputBorder: '#E8E1D8',
    border: '#E8E1D8',
    tabIconDefault: '#9A8F7E',
    tabIconSelected: honeyGold,
    primaryButton: honeyGold,
    primaryButtonText: '#fff',
    secondaryText: '#6B645C',
    accentSage: sageGreen,
    accentSageFaint: 'rgba(79,125,106,0.24)',
    accentSageBorder: 'rgba(79,125,106,0.60)',
    accentTomato: tomato,
    accentTomatoFaint: 'rgba(212,90,78,0.20)',
    tabBarBackground: '#FAF6F0',
    tabBarBorder: '#E8E1D8',
    placeholder: '#888888',
    borderStrong: 'rgba(232,225,216,0.80)',
    overlay: 'rgba(0,0,0,0.5)',
    // Text on gradient/overlay surfaces
    onGradient: '#ffffff',
    onGradientMuted: 'rgba(255,255,255,0.85)',
    onOverlay: '#ffffff',
    onOverlayMuted: 'rgba(255,255,255,0.7)',
    // Brand icon colors (for onboarding, accents)
    brandGold: '#E8C547',
    brandGoldFaint: 'rgba(232,197,71,0.20)',
    brandSage: '#4F7D6A',
    brandSageFaint: 'rgba(79,125,106,0.20)',
    brandAmber: '#C79A2B',
    brandAmberFaint: 'rgba(199,154,43,0.20)',
    // Category palette (recap, tags)
    categoryBlue: '#4A90C4',
    categoryGreen: '#5F9078',
    categoryAmber: '#C79A2B',
    categoryNeutral: '#9A8F7E',
    categoryMuted: '#6B645C',
    // Confetti / celebration
    confetti: ['#E8C547', '#4F7D6A', '#D45A4E', '#4A90C4', '#C79A2B', '#F5EFE6'],
  },
  dark: {
    primaryBrand: tintColorDark,
    tint: tintColorDark,
    primaryBrandFaint: 'rgba(232,197,71,0.20)',
    tintFaint: 'rgba(232,197,71,0.18)',
    tintSoft: 'rgba(232,197,71,0.24)',
    tintBorder: 'rgba(232,197,71,0.50)',
    tintMuted: 'rgba(232,197,71,0.60)',
    surface: '#3D3629',
    surface2: '#362E22',
    elevatedSurface: '#4A4235',
    elevatedSurface2: '#3D3629',
    text: '#F5EFE6',
    textPrimary: '#F5EFE6',
    textSecondary: '#C4B8A8',
    richNeutral: '#F5EFE6',
    richNeutralMuted: '#C4B8A8',
    success: '#5F9078',
    warn: '#E8C547',
    error: '#E07064',
    info: '#6AABDB',
    pressed: '#D4AD3A',
    disabled: '#5C5346',
    disabledText: '#7A7062',
    gradientStart: '#E8C547',
    gradientEnd: '#5F9078',
    gradientStartFaint: 'rgba(232,197,71,0.15)',
    rsvpGoing: '#5F9078',
    rsvpLate: '#E8C547',
    rsvpMaybe: '#9A8F7E',
    rsvpCant: '#E07064',
    bringClaimed: '#5F9078',
    bringUnclaimed: '#C4B8A8',
    bringConflict: '#E07064',
    shadow: shadowDark,
    background: '#2C2419',
    card: '#3D3629',
    inputBorder: '#5C5346',
    border: '#5C5346',
    tabIconDefault: '#9A8F7E',
    tabIconSelected: tintColorDark,
    primaryButton: tintColorDark,
    primaryButtonText: '#2C2419',
    secondaryText: '#C4B8A8',
    accentSage: '#5F9078',
    accentSageFaint: 'rgba(95,144,120,0.24)',
    accentSageBorder: 'rgba(95,144,120,0.60)',
    accentTomato: '#E07064',
    accentTomatoFaint: 'rgba(224,112,100,0.20)',
    tabBarBackground: '#2C2419',
    tabBarBorder: '#5C5346',
    placeholder: '#9A8F7E',
    borderStrong: 'rgba(92,83,70,0.80)',
    overlay: 'rgba(0,0,0,0.6)',
    // Text on gradient/overlay surfaces
    onGradient: '#ffffff',
    onGradientMuted: 'rgba(255,255,255,0.85)',
    onOverlay: '#ffffff',
    onOverlayMuted: 'rgba(255,255,255,0.7)',
    // Brand icon colors
    brandGold: '#E8C547',
    brandGoldFaint: 'rgba(232,197,71,0.20)',
    brandSage: '#5F9078',
    brandSageFaint: 'rgba(95,144,120,0.20)',
    brandAmber: '#D4AD3A',
    brandAmberFaint: 'rgba(212,173,58,0.20)',
    // Category palette (recap, tags)
    categoryBlue: '#6AABDB',
    categoryGreen: '#5F9078',
    categoryAmber: '#D4AD3A',
    categoryNeutral: '#9A8F7E',
    categoryMuted: '#7A7062',
    // Confetti / celebration
    confetti: ['#E8C547', '#5F9078', '#E07064', '#6AABDB', '#D4AD3A', '#F5EFE6'],
  },
};

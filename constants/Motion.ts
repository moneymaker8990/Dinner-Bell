/**
 * Premium motion language: confident, warm, precise.
 * Duration and easing families for orchestrated transitions and micro-interactions.
 * Use with reduced-motion fallback (see useReducedMotion).
 */

/** Duration families (ms) */
export const duration = {
  fast: 150,
  regular: 250,
  emphasized: 360,
  modal: 320,
} as const;

/** Easing curves for Animated.timing (React Native Easing) */
export const curves = {
  /** Confident, slight ease-out */
  fast: [0.33, 1, 0.67, 1] as const,
  standard: [0.4, 0, 0.2, 1] as const,
  emphasized: [0.22, 1, 0.36, 1] as const,
  modal: [0.32, 0.72, 0, 1] as const,
} as const;

/** Timing config for modal/sheet */
export const modalTransition = {
  duration: duration.modal,
  curve: curves.modal,
} as const;

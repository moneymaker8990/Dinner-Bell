import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Returns whether the system "reduce motion" preference is enabled.
 * Use to skip or shorten animations (Epic 2: reduced-motion fallback).
 * On web, checks prefers-reduced-motion media query when available.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduceMotion(mq.matches);
      const listener = () => setReduceMotion(mq.matches);
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }

    let subscription: { remove(): void } | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
    subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription?.remove();
  }, []);

  return reduceMotion;
}

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Haptic map (Epic 2). Use for micro-interactions; no-op on web.
 * - hapticRsvp: RSVP selection (going/late/maybe/can't) — Light
 * - hapticClaim: Claim/unclaim bring item — Medium
 * - hapticBell: Ring bell — Success notification
 * - hapticTap: Generic tap (buttons, cards) — Light
 * - hapticSuccess: Create published, invite sent, etc. — Success notification
 */
export function hapticRsvp(): void {
  if (!isNative) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

export function hapticClaim(): void {
  if (!isNative) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (_) {}
}

export function hapticBell(): void {
  if (!isNative) return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {}
}

export function hapticTap(): void {
  if (!isNative) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (_) {}
}

export function hapticSuccess(): void {
  if (!isNative) return;
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {}
}

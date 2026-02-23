/**
 * Analytics instrumentation (Epic 10).
 * Funnel events for primary flows with properties.
 * Replace the log() calls with your analytics provider (Amplitude, Mixpanel, PostHog, etc.).
 */

import { Platform } from 'react-native';

export type AnalyticsEvent =
  | 'create_start'
  | 'create_step_completed'
  | 'create_published'
  | 'create_failed'
  | 'invite_opened'
  | 'rsvp_submitted'
  | 'bring_claimed'
  | 'bell_triggered'
  | 'app_opened'
  | 'screen_viewed'
  | 'share_initiated'
  | 'premium_gate_shown'
  | 'premium_upgrade_started'
  | 'event_edited'
  | 'event_cancelled'
  | 'guest_added'
  | 'chat_message_sent'
  | 'calendar_added'
  | 'maps_opened'
  | 'profile_updated'
  | 'sign_in'
  | 'sign_up'
  | 'sign_out'
  | 'group_created'
  | 'group_deleted'
  | 'group_member_added'
  | 'waitlist_joined'
  | 'deep_link_opened'
  | 'error';

export interface AnalyticsProperties {
  platform?: string;
  theme?: string;
  role?: 'host' | 'guest' | 'anonymous';
  source?: string;
  step?: number;
  stepName?: string;
  eventId?: string;
  rsvpStatus?: string;
  itemName?: string;
  [key: string]: string | number | boolean | undefined;
}

const analyticsEndpoint = process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT?.trim();

function forwardToEndpoint(event: AnalyticsEvent, properties: AnalyticsProperties): void {
  if (!analyticsEndpoint) return;

  void fetch(analyticsEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event,
      properties,
    }),
  }).catch(() => {
    if (__DEV__) {
      console.warn(`[Analytics] Failed to POST ${event}`);
    }
  });
}

/** Core analytics tracker. Swap implementation for your provider. */
function log(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
  const enriched: AnalyticsProperties = {
    ...properties,
    platform: Platform.OS,
    timestamp: new Date().toISOString(),
  };

  if (__DEV__) {
    console.log(`[Analytics] ${event}`, enriched);
  }

  // Launch-safe integration point: set EXPO_PUBLIC_ANALYTICS_ENDPOINT to forward events.
  forwardToEndpoint(event, enriched);
}

// --- Funnel events ---

export function trackCreateStart(properties?: AnalyticsProperties): void {
  log('create_start', { ...properties, role: 'host' });
}

export function trackCreateStepCompleted(step: number, stepName: string, properties?: AnalyticsProperties): void {
  log('create_step_completed', { ...properties, step, stepName, role: 'host' });
}

export function trackCreatePublished(eventId: string, properties?: AnalyticsProperties): void {
  log('create_published', { ...properties, eventId, role: 'host' });
}

export function trackInviteOpened(eventId: string, source?: string): void {
  log('invite_opened', { eventId, source });
}

export function trackRsvpSubmitted(eventId: string, rsvpStatus: string, role: 'guest' | 'anonymous' = 'guest'): void {
  log('rsvp_submitted', { eventId, rsvpStatus, role });
}

export function trackBringClaimed(eventId: string, itemName: string): void {
  log('bring_claimed', { eventId, itemName, role: 'guest' });
}

export function trackBellTriggered(eventId: string): void {
  log('bell_triggered', { eventId, role: 'host' });
}

export function trackScreenViewed(screenName: string, properties?: AnalyticsProperties): void {
  log('screen_viewed', { ...properties, source: screenName });
}

export function trackShareInitiated(eventId: string, method?: string): void {
  log('share_initiated', { eventId, source: method });
}

export function trackEventEdited(eventId: string): void {
  log('event_edited', { eventId, role: 'host' });
}

export function trackEventCancelled(eventId: string): void {
  log('event_cancelled', { eventId, role: 'host' });
}

export function trackGuestAdded(eventId: string, method: 'email' | 'phone' | 'contacts'): void {
  log('guest_added', { eventId, source: method, role: 'host' });
}

export function trackChatMessageSent(eventId: string): void {
  log('chat_message_sent', { eventId });
}

export function trackCalendarAdded(eventId: string, success: boolean): void {
  log('calendar_added', { eventId, success });
}

export function trackMapsOpened(eventId: string): void {
  log('maps_opened', { eventId });
}

export function trackProfileUpdated(field: string): void {
  log('profile_updated', { source: field });
}

export function trackSignIn(success: boolean): void {
  log('sign_in', { success });
}

export function trackSignUp(success: boolean): void {
  log('sign_up', { success });
}

export function trackSignOut(): void {
  log('sign_out');
}

export function trackGroupCreated(groupId: string): void {
  log('group_created', { eventId: groupId });
}

export function trackGroupDeleted(groupId: string): void {
  log('group_deleted', { eventId: groupId });
}

export function trackGroupMemberAdded(groupId: string): void {
  log('group_member_added', { eventId: groupId });
}

export function trackWaitlistJoined(eventId: string): void {
  log('waitlist_joined', { eventId, role: 'guest' });
}

export function trackDeepLinkOpened(path: string): void {
  log('deep_link_opened', { source: path });
}

export function trackCreateFailed(error: string): void {
  log('create_failed', { source: error, role: 'host' });
}

export function trackError(message: string, componentStack?: string): void {
  log('error', { source: message, componentStack });
}

// --- Key metrics dashboard definitions ---
export const KEY_METRICS = {
  inviteConversion: 'invite_opened → rsvp_submitted',
  rsvpCompletion: 'rsvp_submitted / invite_opened',
  hostRepeat: 'create_published (by same user, 2nd+)',
  bellEngagement: 'bell_triggered / events with bell_time passed',
} as const;

// --- Guardrails ---
export const GUARDRAILS = {
  maxResponseTimeMs: 3000,
  maxErrorRate: 0.02,
} as const;

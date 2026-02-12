/**
 * Premium feature gating (Epic 9).
 * Defines which features are gated behind the paid tier.
 * Core flows remain free for all users.
 */

export type PremiumFeature =
  | 'advanced_themes'
  | 'custom_invite_domain'
  | 'host_analytics'
  | 'larger_capacity'
  | 'co_hosts';

/** Features available on the free tier */
export const FREE_FEATURES = [
  'event_creation',
  'rsvp',
  'bring_list',
  'bell',
  'invite_links',
  'push_reminders',
  'groups',
  'recap',
] as const;

/** Features that require premium */
export const PREMIUM_FEATURES: PremiumFeature[] = [
  'advanced_themes',
  'custom_invite_domain',
  'host_analytics',
  'larger_capacity',
  'co_hosts',
];

/** Human-friendly labels for the plan comparison screen */
export const PREMIUM_FEATURE_LABELS: Record<PremiumFeature, { title: string; description: string }> = {
  advanced_themes: {
    title: 'Custom Themes',
    description: 'Unlock seasonal and custom color themes for your events.',
  },
  custom_invite_domain: {
    title: 'Custom Invite Links',
    description: 'Use your own domain for invite links.',
  },
  host_analytics: {
    title: 'Host Analytics',
    description: 'See RSVP trends, guest reliability, and engagement stats.',
  },
  larger_capacity: {
    title: 'Larger Events',
    description: 'Host events with up to 100 guests (free: 25).',
  },
  co_hosts: {
    title: 'Co-Hosts',
    description: 'Add co-hosts who can manage the event with you.',
  },
};

/** Stub: check if user has premium. Replace with real entitlement check. */
let _isPremium = false;
export function isPremiumUser(): boolean {
  return _isPremium;
}
export function setPremiumUser(value: boolean): void {
  _isPremium = value;
}

/** Check if a specific feature is available to the current user */
export function isFeatureAvailable(feature: PremiumFeature): boolean {
  return isPremiumUser();
}

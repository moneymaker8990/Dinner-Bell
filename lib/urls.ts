const FALLBACK_WEB_BASE_URL = 'https://dinnerbell.app';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getPublicBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (configured) return trimTrailingSlash(configured);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }
  return FALLBACK_WEB_BASE_URL;
}

export function buildInviteUrl(eventId: string, token: string): string {
  return `${getPublicBaseUrl()}/invite/${eventId}?token=${token}`;
}

export function buildEventUrl(eventId: string): string {
  return `${getPublicBaseUrl()}/event/${eventId}`;
}

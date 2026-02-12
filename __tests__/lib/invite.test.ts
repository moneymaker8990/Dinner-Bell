import { normalizePhoneForLookup } from '@/lib/invite';

describe('normalizePhoneForLookup', () => {
  it('strips non-digit characters', () => {
    expect(normalizePhoneForLookup('+1 (234) 567-8900')).toBe('12345678900');
  });

  it('handles plain digits', () => {
    expect(normalizePhoneForLookup('5551234567')).toBe('5551234567');
  });

  it('strips spaces and dashes', () => {
    expect(normalizePhoneForLookup('555-123-4567')).toBe('5551234567');
  });

  it('handles international format', () => {
    expect(normalizePhoneForLookup('+44 20 7946 0958')).toBe('442079460958');
  });

  it('returns empty string for empty input', () => {
    expect(normalizePhoneForLookup('')).toBe('');
  });

  it('handles phone with dots', () => {
    expect(normalizePhoneForLookup('555.123.4567')).toBe('5551234567');
  });
});

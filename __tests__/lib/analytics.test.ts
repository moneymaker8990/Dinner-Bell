import {
    trackBellTriggered,
    trackBringClaimed,
    trackCreatePublished,
    trackCreateStart,
    trackError,
    trackRsvpSubmitted,
    trackScreenViewed,
    trackShareInitiated,
    trackSignIn,
    trackSignUp,
} from '@/lib/analytics';

// Analytics uses console.log in __DEV__, so we spy on it
const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

afterEach(() => {
  consoleSpy.mockClear();
});

afterAll(() => {
  consoleSpy.mockRestore();
});

describe('Analytics', () => {
  it('tracks create_start event', () => {
    trackCreateStart({ theme: 'dinner' });
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] create_start',
      expect.objectContaining({ role: 'host', theme: 'dinner' })
    );
  });

  it('tracks create_published event with eventId', () => {
    trackCreatePublished('evt_123');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] create_published',
      expect.objectContaining({ eventId: 'evt_123', role: 'host' })
    );
  });

  it('tracks rsvp_submitted event', () => {
    trackRsvpSubmitted('evt_456', 'going', 'guest');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] rsvp_submitted',
      expect.objectContaining({ eventId: 'evt_456', rsvpStatus: 'going', role: 'guest' })
    );
  });

  it('tracks bell_triggered event', () => {
    trackBellTriggered('evt_789');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] bell_triggered',
      expect.objectContaining({ eventId: 'evt_789', role: 'host' })
    );
  });

  it('tracks sign_in event', () => {
    trackSignIn(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] sign_in',
      expect.objectContaining({ success: true })
    );
  });

  it('tracks sign_up event', () => {
    trackSignUp(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] sign_up',
      expect.objectContaining({ success: false })
    );
  });

  it('tracks error event', () => {
    trackError('Test error', '<Stack trace>');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] error',
      expect.objectContaining({ source: 'Test error', componentStack: '<Stack trace>' })
    );
  });

  it('tracks screen_viewed event', () => {
    trackScreenViewed('HomeScreen');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] screen_viewed',
      expect.objectContaining({ source: 'HomeScreen' })
    );
  });

  it('tracks share_initiated event', () => {
    trackShareInitiated('evt_abc', 'clipboard');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] share_initiated',
      expect.objectContaining({ eventId: 'evt_abc', source: 'clipboard' })
    );
  });

  it('tracks bring_claimed event', () => {
    trackBringClaimed('evt_def', 'Potato Salad');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] bring_claimed',
      expect.objectContaining({ eventId: 'evt_def', itemName: 'Potato Salad', role: 'guest' })
    );
  });

  it('enriches events with platform and timestamp', () => {
    trackCreateStart();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Analytics] create_start',
      expect.objectContaining({
        platform: expect.any(String),
        timestamp: expect.any(String),
      })
    );
  });
});

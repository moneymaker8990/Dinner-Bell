import type { EventWithDetails } from '@/types/events';

/** Creates a local-only demo event for previewing the UI when the user has no events. */
export function createDemoEvent(): EventWithDetails {
  const now = new Date();
  const startTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3h from now
  const bellTime = new Date(startTime.getTime() - 15 * 60 * 1000); // 15 min before
  const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2h duration

  return {
    id: '__demo__',
    host_user_id: '__demo_user__',
    title: 'Friday Night Feast',
    description: 'A cozy dinner with good friends, great food, and stories worth telling.',
    start_time: startTime.toISOString(),
    bell_time: bellTime.toISOString(),
    end_time: endTime.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    address_line1: '42 Maple Lane',
    address_line2: null,
    city: 'Brooklyn',
    state: 'NY',
    postal_code: '11201',
    country: 'US',
    location_name: "Sam's Place",
    location_notes: 'Buzzer is #3B. Come hungry.',
    invite_token: 'demo-token',
    is_cancelled: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  } as EventWithDetails;
}

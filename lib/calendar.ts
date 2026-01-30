import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export interface AddToCalendarOptions {
  title: string;
  startTime: string; // ISO
  endTime?: string; // ISO, optional
  location?: string;
  notes?: string;
  url?: string;
}

/** Request calendar permission and add event to device calendar. Returns true if added. */
export async function addEventToCalendar(options: AddToCalendarOptions): Promise<{ ok: boolean; message?: string }> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, message: 'Calendar permission is needed to add the event.' };
    }
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCalendar = calendars.find((c) => c.allowsModifications) ?? calendars[0];
    if (!defaultCalendar) {
      return { ok: false, message: 'No calendar available.' };
    }
    const start = new Date(options.startTime);
    const end = options.endTime ? new Date(options.endTime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const details: Partial<Calendar.Event> = {
      title: options.title,
      startDate: start,
      endDate: end,
      location: options.location ?? undefined,
      notes: options.notes ? (options.url ? `${options.notes}\n${options.url}` : options.notes) : options.url,
    };
    if (Platform.OS === 'ios') {
      await Calendar.createEventAsync(defaultCalendar.id, details);
    } else {
      await Calendar.createEventAsync(defaultCalendar.id, details);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not add to calendar.' };
  }
}

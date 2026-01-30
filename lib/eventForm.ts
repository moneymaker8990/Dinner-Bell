import type { BringItemCategory } from '@/types/database';

export interface CreateEventForm {
  title: string;
  description: string;
  startTime: string;
  bellTime: string;
  endTime: string;
  timezone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  locationName: string;
  locationNotes: string;
  menuSections: { id: string; title: string; items: { id: string; name: string; notes: string; dietaryTags: string[] }[] }[];
  bringItems: { id: string; name: string; quantity: string; category: BringItemCategory; isRequired: boolean; isClaimable: boolean; notes: string }[];
  scheduleBlocks: { id: string; title: string; time: string; notes: string }[];
  guestEmails: string[];
  noteToGuests: string;
}

export const defaultForm: CreateEventForm = {
  title: '',
  description: '',
  startTime: new Date().toISOString().slice(0, 16),
  bellTime: new Date().toISOString().slice(0, 16),
  endTime: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  locationName: '',
  locationNotes: '',
  menuSections: [{ id: crypto.randomUUID(), title: 'Main', items: [] }],
  bringItems: [],
  scheduleBlocks: [{ id: crypto.randomUUID(), title: 'Dinner', time: '', notes: '' }],
  guestEmails: [],
  noteToGuests: '',
};

export function generateId(): string {
  return crypto.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

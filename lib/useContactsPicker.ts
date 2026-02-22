import { normalizePhoneForLookup } from '@/lib/invite';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

export type ContactInviteTarget = {
  id: string;
  name: string;
  value: string;
  type: 'phone' | 'email';
};

export function useContactsPicker() {
  const [modalVisible, setModalVisible] = useState(false);
  const [contactsList, setContactsList] = useState<ContactInviteTarget[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isWeb = Platform.OS === 'web';

  const openPicker = useCallback(async () => {
    if (isWeb) return;
    setContactsError(null);
    setContactsLoading(true);
    setContactsList([]);
    setSelectedIds(new Set());
    setModalVisible(true);
    try {
      const Contacts = await import('expo-contacts');
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setContactsError('Contacts access is needed to invite from your contacts. You can enable it in Settings.');
        setContactsLoading(false);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        sort: Contacts.SortTypes.FirstName,
      });
      const targets: ContactInviteTarget[] = [];
      for (const c of data) {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown';
        const phones = c.phoneNumbers ?? [];
        const emails = c.emails ?? [];

        for (const p of phones) {
          const number = p.number ?? p.digits ?? '';
          const normalized = normalizePhoneForLookup(number);
          if (normalized.length < 10) continue;
          targets.push({
            id: `${c.id}:phone:${normalized}`,
            name,
            value: normalized,
            type: 'phone',
          });
        }

        for (const e of emails) {
          const normalizedEmail = (e.email ?? '').trim().toLowerCase();
          if (!normalizedEmail || !normalizedEmail.includes('@')) continue;
          targets.push({
            id: `${c.id}:email:${normalizedEmail}`,
            name,
            value: normalizedEmail,
            type: 'email',
          });
        }
      }

      const seen = new Set<string>();
      const deduped = targets.filter((c) => {
        const dedupeKey = `${c.type}:${c.value}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });

      setContactsList(deduped);
    } catch {
      setContactsError('Could not load contacts.');
    } finally {
      setContactsLoading(false);
    }
  }, [isWeb]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  return {
    isWeb,
    modalVisible,
    setModalVisible,
    openPicker,
    contactsList,
    contactsLoading,
    contactsError,
    selectedIds,
    setSelectedIds,
    toggleSelection,
    clearSelection,
    closeModal,
  };
}

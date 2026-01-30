import { normalizePhoneForLookup } from '@/lib/invite';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

export type ContactWithPhone = { id: string; name: string; phone: string };

export function useContactsPicker() {
  const [modalVisible, setModalVisible] = useState(false);
  const [contactsList, setContactsList] = useState<ContactWithPhone[]>([]);
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
        fields: [Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      });
      const withPhones = data
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map((c) => {
          const number = c.phoneNumbers![0].number ?? c.phoneNumbers![0].digits ?? '';
          const normalized = normalizePhoneForLookup(number);
          if (normalized.length < 10) return null;
          return {
            id: c.id,
            name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unknown',
            phone: normalized,
          };
        })
        .filter((c): c is ContactWithPhone => c !== null);
      const seen = new Set<string>();
      const deduped = withPhones.filter((c) => {
        if (seen.has(c.phone)) return false;
        seen.add(c.phone);
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

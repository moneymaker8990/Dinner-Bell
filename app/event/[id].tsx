import { BringListItem } from '@/components/BringListItem';
import { RingBellButton } from '@/components/RingBellButton';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createDemoEvent } from '@/lib/demoEvent';
import { addGuestByHost, sendInvitePush } from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import type { BringItemRow, EventGuest, EventWithDetails, MenuItemRow, MenuSection, ScheduleBlockRow } from '@/types/events';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput } from 'react-native';

function formatCountdown(bellTime: string): string {
  const bell = new Date(bellTime);
  const now = new Date();
  const diff = bell.getTime() - now.getTime();
  if (diff <= 0) return 'Bell time passed';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

function fullAddress(e: EventWithDetails): string {
  const parts = [e.address_line1, e.address_line2, e.city, e.state, e.postal_code, e.country].filter(Boolean);
  return parts.join(', ');
}

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string; guestId?: string }>();
  const id = params.id;
  const urlGuestId = params.guestId;
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [menuSections, setMenuSections] = useState<(MenuSection & { menu_items: MenuItemRow[] })[]>([]);
  const [bringItems, setBringItems] = useState<BringItemRow[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlockRow[]>([]);
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [currentGuest, setCurrentGuest] = useState<EventGuest | null>(null);
  const [hostName, setHostName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const toast = useToast();
  const isHost = user && event?.host_user_id === user.id;
  const guestId = currentGuest?.id ?? urlGuestId ?? null;
  const guestName = currentGuest?.guest_name ?? undefined;

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      if (id === '__demo__') {
        setEvent(createDemoEvent());
        setMenuSections([]);
        setBringItems([]);
        setScheduleBlocks([]);
        setGuests([]);
        setHostName('Demo');
        setLoading(false);
        return;
      }
      if (!user && urlGuestId) {
        const { data: full, error: rpcError } = await (supabase as any).rpc('get_event_full_for_guest', {
          p_event_id: id,
          p_guest_id: urlGuestId,
        });
        if (rpcError || !full) {
          setError('Event not found');
          setLoading(false);
          return;
        }
        const payload = full as {
          event: EventWithDetails;
          menu_sections: MenuSection[];
          menu_items: MenuItemRow[];
          bring_items: BringItemRow[];
          schedule_blocks: ScheduleBlockRow[];
          guests: EventGuest[];
        };
        setEvent(payload.event);
        const sectionMap = new Map<string, MenuSection & { menu_items: MenuItemRow[] }>();
        (payload.menu_sections ?? []).forEach((s: MenuSection) => sectionMap.set(s.id, { ...s, menu_items: [] }));
        (payload.menu_items ?? []).forEach((item: MenuItemRow) => {
          const sec = sectionMap.get(item.section_id);
          if (sec) sec.menu_items.push(item);
        });
        setMenuSections(Array.from(sectionMap.values()).sort((a, b) => a.sort_order - b.sort_order));
        setBringItems(payload.bring_items ?? []);
        setScheduleBlocks(payload.schedule_blocks ?? []);
        setGuests(payload.guests ?? []);
        const me = (payload.guests ?? []).find((g: EventGuest) => g.id === urlGuestId);
        setCurrentGuest(me ?? null);
        setLoading(false);
        return;
      }

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      if (eventData && (eventData as EventWithDetails).is_cancelled) {
        setError('This event has been cancelled');
        setLoading(false);
        return;
      }
      if (eventError || !eventData) {
        setError('Event not found');
        setLoading(false);
        return;
      }
      setEvent(eventData as EventWithDetails);
      const { data: hostProfile } = await supabase.from('profiles').select('name').eq('id', (eventData as EventWithDetails).host_user_id).single();
      setHostName((hostProfile as { name?: string } | null)?.name ?? null);

      const [{ data: sections }, { data: items }, { data: bring }, { data: blocks }, { data: guestList }] = await Promise.all([
        supabase.from('menu_sections').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('menu_items').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('bring_items').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('schedule_blocks').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('event_guests').select('*').eq('event_id', id),
      ]);

      const sectionMap = new Map<string, MenuSection & { menu_items: MenuItemRow[] }>();
      (sections ?? []).forEach((s: MenuSection) => sectionMap.set(s.id, { ...s, menu_items: [] }));
      (items ?? []).forEach((item: MenuItemRow) => {
        const sec = sectionMap.get(item.section_id);
        if (sec) sec.menu_items.push(item);
      });
      setMenuSections(Array.from(sectionMap.values()).sort((a, b) => a.sort_order - b.sort_order));
      setBringItems(bring ?? []);
      setScheduleBlocks(blocks ?? []);
      setGuests(guestList ?? []);
      if (user) {
        const me = (guestList ?? []).find((g: EventGuest) => g.user_id === user.id) ?? (guestList ?? []).find((g: EventGuest) => g.guest_phone_or_email === user.email);
        setCurrentGuest(me ?? null);
      } else if (urlGuestId) {
        const me = (guestList ?? []).find((g: EventGuest) => g.id === urlGuestId);
        setCurrentGuest(me ?? null);
      } else {
        setCurrentGuest(null);
      }
      setLoading(false);
    };
    fetch();
  }, [id, user, urlGuestId]);

  useEffect(() => {
    if (!id || id === '__demo__') return;
    const channel = supabase
      .channel(`bring_items:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bring_items', filter: `event_id=eq.${id}` }, () => {
        supabase.from('bring_items').select('*').eq('event_id', id).order('sort_order').then(({ data }) => setBringItems(data ?? []));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleNavigate = () => {
    if (!event) return;
    const address = encodeURIComponent(fullAddress(event));
    const url = Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${address}`
      : `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    Linking.openURL(url);
  };

  const handleShare = async () => {
    if (!event?.invite_token) return;
    const url = `https://dinnerbell.app/invite/${id}?token=${event.invite_token}`;
    try {
      await Share.share({ message: `You're invited to ${event.title}. RSVP: ${url}`, url });
    } catch (_) {}
  };

  const handleCopyAddress = async () => {
    if (!event) return;
    await Clipboard.setStringAsync(fullAddress(event));
  };

  const handleMarkProvided = async (itemId: string) => {
    await (supabase as any).from('bring_items').update({ status: 'provided' }).eq('id', itemId);
  };

  const refreshBringItems = () => {
    if (!id || id === '__demo__') return;
    supabase.from('bring_items').select('*').eq('event_id', id).order('sort_order').then(({ data }) => setBringItems(data ?? []));
  };

  const handleCancelEvent = () => {
    if (!id || !event || !isHost) return;
    (supabase as any).from('events').update({ is_cancelled: true }).eq('id', id).eq('host_user_id', user!.id).then(() => router.replace('/(tabs)'));
  };

  const openInviteModal = () => {
    setInviteEmail('');
    setInviteName('');
    setInviteError(null);
    setInviteModalVisible(true);
  };

  const handleAddGuestByEmail = async () => {
    if (!id || !inviteEmail.trim()) {
      setInviteError('Enter an email');
      return;
    }
    setInviteSubmitting(true);
    setInviteError(null);
    const guestId = await addGuestByHost(id, inviteEmail.trim(), inviteName.trim() || undefined);
    if (guestId) {
      await sendInvitePush(id, inviteEmail.trim());
      setInviteEmail('');
      setInviteName('');
      supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
    } else {
      setInviteError('Could not add guest');
    }
    setInviteSubmitting(false);
  };

  const handleShareFromModal = async () => {
    if (!event?.invite_token) return;
    const url = `https://dinnerbell.app/invite/${id}?token=${event.invite_token}`;
    try {
      await Share.share({ message: `You're invited to ${event.title}. RSVP: ${url}`, url });
    } catch (_) {}
    setInviteModalVisible(false);
  };

  const handleCopyInviteLink = async () => {
    if (!event?.invite_token) return;
    const url = `https://dinnerbell.app/invite/${id}?token=${event.invite_token}`;
    await Clipboard.setStringAsync(url);
    toast.show('Invite link copied 🔗');
  };

  if (loading) return <Text style={styles.centered}>Loading...</Text>;
  if (error || !event) return <Text style={styles.centered}>{error ?? 'Event not found'}</Text>;

  const going = guests.filter((g) => g.rsvp_status === 'going').length;
  const maybe = guests.filter((g) => g.rsvp_status === 'maybe').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{event.title}</Text>
      {hostName ? <Text style={styles.hostName}>Hosted by {hostName}</Text> : null}
      <Text style={styles.countdown}>{formatCountdown(event.bell_time)}</Text>
      {isHost && (
        <RingBellButton eventId={event.id} />
      )}
      {isHost && (
        <View style={styles.hostActions}>
          <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={() => router.push(`/event/${id}/edit`)}>
            <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>Edit event</Text>
          </Pressable>
          <Pressable style={styles.buttonSecondary} onPress={openInviteModal}>
            <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Invite more</Text>
          </Pressable>
          <Pressable style={styles.cancelEventBtn} onPress={handleCancelEvent}>
            <Text style={styles.cancelEventText}>Cancel event</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.body}>{fullAddress(event)}</Text>
        {event.location_notes ? <Text style={styles.notes}>{event.location_notes}</Text> : null}
        <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={handleNavigate}>
          <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>Navigate</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={handleCopyAddress}>
          <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Copy address</Text>
        </Pressable>
      </View>
      {menuSections.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menu</Text>
          {menuSections.map((sec) => (
            <View key={sec.id}>
              <Text style={styles.subsectionTitle}>{sec.title}</Text>
              {sec.menu_items.map((item) => (
                <View key={item.id} style={styles.menuItemRow}>
                  <Text style={styles.body}>• {item.name}</Text>
                  {item.dietary_tags && item.dietary_tags.length > 0 && (
                    <View style={styles.dietaryRow}>
                      {item.dietary_tags.map((tag) => (
                        <View
                          key={tag}
                          style={[styles.dietaryChip, { backgroundColor: colors.accentSage + '24', borderColor: colors.accentSage + '60' }]}>
                          <Text style={[styles.dietaryChipText, { color: colors.accentSage }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
      {bringItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bring list</Text>
          {bringItems.map((item) => (
            <View key={item.id}>
              <BringListItem
                item={item}
                eventId={id}
                guestId={guestId}
                guestName={guestName}
                onClaimed={refreshBringItems}
              />
              {isHost && item.status === 'claimed' && (
                <Pressable style={styles.smallBtn} onPress={() => handleMarkProvided(item.id)}>
                  <Text style={[styles.smallBtnText, { color: colors.tint }]}>Mark provided</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
      {scheduleBlocks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          {scheduleBlocks.map((block) => (
            <Text key={block.id} style={styles.body}>
              {block.time ? new Date(block.time).toLocaleTimeString() : '—'} {block.title}
            </Text>
          ))}
        </View>
      )}
      {isHost && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guests</Text>
          <Text style={styles.body}>Going: {going} | Maybe: {maybe}</Text>
        </View>
      )}
      {!isHost && (
        <View style={styles.guestShareRow}>
          <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={handleShare}>
            <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>Share link</Text>
          </Pressable>
          <Pressable style={styles.buttonSecondary} onPress={handleCopyInviteLink}>
            <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Copy invite link</Text>
          </Pressable>
        </View>
      )}

      {isHost && (
        <Modal visible={inviteModalVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setInviteModalVisible(false)}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Invite more</Text>
              <Text style={styles.label}>Guest email</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.inputBorder }]}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="email@example.com"
                placeholderTextColor="#888"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.label}>Name (optional)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.inputBorder }]}
                value={inviteName}
                onChangeText={setInviteName}
                placeholder="Guest name"
                placeholderTextColor="#888"
              />
              {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
              <Pressable
                style={[styles.button, { backgroundColor: colors.primaryButton }, inviteSubmitting && styles.buttonDisabled]}
                onPress={handleAddGuestByEmail}
                disabled={inviteSubmitting}
              >
                <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{inviteSubmitting ? 'Adding...' : 'Add & send invite'}</Text>
              </Pressable>
              <Pressable style={styles.buttonSecondary} onPress={handleShareFromModal}>
                <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Share link instead</Text>
              </Pressable>
              <Pressable style={styles.buttonSecondary} onPress={handleCopyInviteLink}>
                <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Copy invite link</Text>
              </Pressable>
              <Pressable style={styles.modalCancel} onPress={() => setInviteModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, textAlign: 'center', marginTop: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  hostName: { fontSize: 14, opacity: 0.8, marginBottom: 8 },
  countdown: { fontSize: 16, opacity: 0.8, marginBottom: 16 },
  hostActions: { marginBottom: 16 },
  cancelEventBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
  cancelEventText: { fontSize: 14, color: '#c00', fontWeight: '500' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  subsectionTitle: { fontSize: 16, fontWeight: '500', marginTop: 8, marginBottom: 4 },
  menuItemRow: { marginBottom: 6 },
  dietaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginLeft: 16 },
  dietaryChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  dietaryChipText: { fontSize: 12, fontWeight: '500' },
  body: { fontSize: 14, marginBottom: 4 },
  notes: { fontSize: 14, opacity: 0.8, marginTop: 4 },
  button: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { fontWeight: '600' },
  buttonSecondary: { padding: 16, alignItems: 'center', marginTop: 4 },
  buttonSecondaryText: { fontWeight: '600' },
  guestShareRow: { marginTop: 8 },
  smallBtn: { padding: 8, alignItems: 'flex-start', marginTop: 4 },
  smallBtnText: { fontSize: 14, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  errorText: { color: '#c00', marginBottom: 8 },
  buttonDisabled: { opacity: 0.6 },
  modalCancel: { padding: 12, alignItems: 'center', marginTop: 8 },
  modalCancelText: { fontWeight: '500' },
});

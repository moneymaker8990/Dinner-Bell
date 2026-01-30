import { Avatar } from '@/components/Avatar';
import { BringListItem } from '@/components/BringListItem';
import { RingBellButton } from '@/components/RingBellButton';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { addEventToCalendar } from '@/lib/calendar';
import { createDemoEvent } from '@/lib/demoEvent';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { addGuestByHost, addGuestByHostPhone, normalizePhoneForLookup, sendInvitePush, sendInvitePushByPhone } from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import type { BringItemRow, EventGuest, EventWithDetails, MenuItemRow, MenuSection, ScheduleBlockRow } from '@/types/events';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput } from 'react-native';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

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
  const [invitePhone, setInvitePhone] = useState('');
  const [invitePhoneName, setInvitePhoneName] = useState('');
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [contactsList, setContactsList] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [addingFromContacts, setAddingFromContacts] = useState(false);
  const [dietaryFilter, setDietaryFilter] = useState<string | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [messages, setMessages] = useState<{ id: string; user_id: string; body: string; created_at: string }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const bringListCompleteShown = useRef(false);

  const toast = useToast();
  const guestById = useCallback(() => {
    const map = new Map<string, EventGuest>();
    guests.forEach((g) => map.set(g.id, g));
    return map;
  }, [guests]);
  const isWeb = Platform.OS === 'web';
  const [coHostIds, setCoHostIds] = useState<string[]>([]);
  const isHost = user && event?.host_user_id === user.id;
  const isCoHost = user && coHostIds.includes(user.id);
  const isHostOrCoHost = isHost || isCoHost;
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

      const [{ data: sections }, { data: items }, { data: bring }, { data: blocks }, { data: guestList }, { data: coHostsData }] = await Promise.all([
        supabase.from('menu_sections').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('menu_items').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('bring_items').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('schedule_blocks').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('event_guests').select('*').eq('event_id', id),
        supabase.from('event_co_hosts').select('user_id').eq('event_id', id),
      ]);
      setCoHostIds((coHostsData ?? []).map((c: { user_id: string }) => c.user_id));

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
  }, [id, user?.id ?? null, urlGuestId]);

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

  useEffect(() => {
    if (!id || id === '__demo__') return;
    const channel = supabase
      .channel(`event_guests:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_guests', filter: `event_id=eq.${id}` }, () => {
        supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (bringItems.length === 0 || bringListCompleteShown.current) return;
    const claimedOrProvided = bringItems.filter((i) => i.status === 'claimed' || i.status === 'provided').length;
    if (claimedOrProvided === bringItems.length) {
      bringListCompleteShown.current = true;
      hapticSuccess();
      toast.show('Bring list complete!');
    }
  }, [bringItems, toast]);

  const now = Date.now();
  const bellTimeMs = event ? new Date(event.bell_time).getTime() : 0;
  const endTimeMs = event?.end_time ? new Date(event.end_time).getTime() : bellTimeMs + 2 * 60 * 60 * 1000;
  const isInEventWindow = event && now >= bellTimeMs - 30 * 60 * 1000 && now <= endTimeMs;
  const isPastBell = event && now >= bellTimeMs;
  const isEventOver = event && now > endTimeMs;

  useEffect(() => {
    if (!chatVisible || !id || id === '__demo__') return;
    supabase.from('event_messages').select('id, user_id, body, created_at').eq('event_id', id).order('created_at', { ascending: true }).then(({ data }) => setMessages((data ?? []) as { id: string; user_id: string; body: string; created_at: string }[]));
    const channel = supabase
      .channel(`event_messages:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_messages', filter: `event_id=eq.${id}` }, () => {
        supabase.from('event_messages').select('id, user_id, body, created_at').eq('event_id', id).order('created_at', { ascending: true }).then(({ data }) => setMessages((data ?? []) as { id: string; user_id: string; body: string; created_at: string }[]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatVisible, id]);

  const sendMessage = async () => {
    if (!id || !user || !newMessage.trim()) return;
    setSendingMessage(true);
    await supabase.from('event_messages').insert({ event_id: id, user_id: user.id, body: newMessage.trim() });
    setNewMessage('');
    setSendingMessage(false);
  };

  const handleNavigate = () => {
    if (!event) return;
    hapticTap();
    if (guestId && !isHost) {
      supabase.from('event_guests').update({ arrival_status: 'on_the_way' }).eq('id', guestId).then(() => {
        supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
      });
    }
    const address = encodeURIComponent(fullAddress(event));
    const url = Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${address}`
      : `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    Linking.openURL(url);
  };

  const handleArrived = () => {
    if (!guestId || isHost) return;
    hapticTap();
    supabase.from('event_guests').update({ arrival_status: 'arrived', arrived_at: new Date().toISOString() }).eq('id', guestId).then(() => {
      supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
    });
    toast.show("You're here! Host has been notified.");
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

  const handleAddToCalendar = async () => {
    if (!event) return;
    hapticTap();
    const result = await addEventToCalendar({
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time ?? undefined,
      location: fullAddress(event),
      url: `https://dinnerbell.app/event/${id}`,
    });
    if (result.ok) toast.show('Added to your calendar.');
    else toast.show(result.message ?? 'Could not add to calendar.');
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
    setInvitePhone('');
    setInvitePhoneName('');
    setInviteError(null);
    setInviteModalVisible(true);
  };

  const openContactsPicker = useCallback(async () => {
    if (isWeb) return;
    setContactsError(null);
    setContactsLoading(true);
    setContactsList([]);
    setSelectedContactIds(new Set());
    setContactsModalVisible(true);
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
        .filter((c): c is { id: string; name: string; phone: string } => c !== null);
      const seen = new Set<string>();
      const deduped = withPhones.filter((c) => {
        if (seen.has(c.phone)) return false;
        seen.add(c.phone);
        return true;
      });
      setContactsList(deduped);
    } catch (e) {
      setContactsError('Could not load contacts.');
    } finally {
      setContactsLoading(false);
    }
  }, [isWeb]);

  const toggleContactSelection = useCallback((id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddSelectedFromContacts = async () => {
    if (!id || selectedContactIds.size === 0) return;
    setAddingFromContacts(true);
    let added = 0;
    for (const contact of contactsList) {
      if (!selectedContactIds.has(contact.id)) continue;
      const guestId = await addGuestByHostPhone(id, contact.phone, contact.name);
      if (guestId) {
        added += 1;
        await sendInvitePushByPhone(id, contact.phone);
      }
    }
    setAddingFromContacts(false);
    setContactsModalVisible(false);
    setSelectedContactIds(new Set());
    supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
    toast.show(added > 0 ? `Added ${added} guest${added > 1 ? 's' : ''}; push sent to those who have the app.` : 'No guests added.');
  };

  const handleAddGuestByPhone = async () => {
    if (!id || !invitePhone.trim()) {
      setInviteError('Enter a phone number');
      return;
    }
    const normalized = normalizePhoneForLookup(invitePhone);
    if (normalized.length < 10) {
      setInviteError('Enter a valid phone number');
      return;
    }
    setInviteSubmitting(true);
    setInviteError(null);
    const guestId = await addGuestByHostPhone(id, normalized, invitePhoneName.trim() || undefined);
    if (guestId) {
      await sendInvitePushByPhone(id, normalized);
      setInvitePhone('');
      setInvitePhoneName('');
      supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
      toast.show('Guest added; push sent if they have the app.');
    } else {
      setInviteError('Could not add guest');
    }
    setInviteSubmitting(false);
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

  const goingGuests = guests.filter((g) => g.rsvp_status === 'going');
  const lateGuests = guests.filter((g) => g.rsvp_status === 'late');
  const maybeGuests = guests.filter((g) => g.rsvp_status === 'maybe');
  const arrivedGuests = guests.filter((g) => (g as EventGuest & { arrived_at?: string }).arrived_at);
  const onTheWayGuests = guests.filter((g) => (g as EventGuest & { arrival_status?: string }).arrival_status === 'on_the_way');

  const accentColor = (event as EventWithDetails & { accent_color?: string | null }).accent_color ?? colors.tint;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {(event as EventWithDetails & { accent_color?: string | null }).accent_color ? (
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      ) : null}
      <Text style={styles.title}>{event.title}</Text>
      {hostName ? (
        <Text style={styles.hostName}>
          Hosted by {hostName}
          {isHost ? ' (Host)' : isCoHost ? ' (Co-host)' : guestId ? ' (Guest)' : ''}
        </Text>
      ) : null}
      <Text style={styles.countdown}>{formatCountdown(event.bell_time)}</Text>
      {isInEventWindow && (
        <View style={[styles.inEventBanner, { backgroundColor: colors.tint + '20', borderColor: colors.tint + '50' }]}>
          <Text style={styles.inEventTitle}>{isPastBell ? 'Dinner is on' : `Bell in ${formatCountdown(event.bell_time)}`}</Text>
          <View style={styles.quickActionsRow}>
            {isHostOrCoHost && (
              <RingBellButton eventId={event.id} bellSound={(event as EventWithDetails & { bell_sound?: string }).bell_sound} />
            )}
            {(user && (isHost || guestId)) && (
              <Pressable style={[styles.quickActionChip, { borderColor: colors.tint }]} onPress={() => setChatVisible(true)}>
                <Text style={[styles.quickActionChipText, { color: colors.tint }]}>Open chat</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
      {isHostOrCoHost && !isInEventWindow && (
        <RingBellButton eventId={event.id} bellSound={(event as EventWithDetails & { bell_sound?: string }).bell_sound} />
      )}
      {isHostOrCoHost && (
        <View style={styles.hostActions}>
          <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={() => router.push(`/event/${id}/edit`)}>
            <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>Edit event</Text>
          </Pressable>
          <Pressable style={styles.buttonSecondary} onPress={openInviteModal}>
            <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Invite more</Text>
          </Pressable>
          {isHost && (
            <Pressable style={styles.cancelEventBtn} onPress={handleCancelEvent}>
              <Text style={styles.cancelEventText}>Cancel event</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.body}>{fullAddress(event)}</Text>
        {event.location_notes ? (
          <View style={[styles.arrivalNotesCard, { backgroundColor: colors.tint + '18', borderColor: colors.tint + '40' }]}>
            <Text style={styles.arrivalNotesLabel}>Arrival notes</Text>
            <Text style={styles.arrivalNotesText}>{event.location_notes}</Text>
          </View>
        ) : null}
        <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={handleNavigate}>
          <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>Navigate</Text>
        </Pressable>
        {!isHost && guestId && (currentGuest as EventGuest & { arrival_status?: string })?.arrival_status !== 'arrived' && (
          <>
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>I'm </Text>
              {[5, 10, 15].map((mins) => (
                <Pressable
                  key={mins}
                  style={[styles.etaBtn, { borderColor: colors.inputBorder }]}
                  onPress={() => {
                    hapticTap();
                    supabase.from('event_guests').update({ eta_minutes: mins }).eq('id', guestId).then(() => {
                      supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
                    });
                  }}
                >
                  <Text style={[styles.etaBtnText, { color: colors.tint }]}>{mins} min away</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.buttonSecondary, { marginTop: 8 }]} onPress={handleArrived}>
              <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>I've arrived</Text>
            </Pressable>
          </>
        )}
        <Pressable style={styles.buttonSecondary} onPress={handleCopyAddress}>
          <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Copy address</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={handleAddToCalendar}>
          <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Add to calendar</Text>
        </Pressable>
      </View>
      {menuSections.length > 0 && (() => {
        const allTags = Array.from(new Set(menuSections.flatMap((s) => s.menu_items.flatMap((i) => i.dietary_tags ?? []))));
        const filteredSections = dietaryFilter
          ? menuSections.map((sec) => ({
              ...sec,
              menu_items: sec.menu_items.filter((i) => (i.dietary_tags ?? []).includes(dietaryFilter)),
            })).filter((sec) => sec.menu_items.length > 0)
          : menuSections;
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Menu</Text>
            {allTags.length > 0 && (
              <View style={styles.dietaryFilterRow}>
                <Pressable
                  style={[styles.dietaryFilterChip, !dietaryFilter && styles.dietaryFilterChipActive]}
                  onPress={() => setDietaryFilter(null)}
                >
                  <Text style={styles.dietaryFilterChipText}>All</Text>
                </Pressable>
                {allTags.map((tag) => (
                  <Pressable
                    key={tag}
                    style={[styles.dietaryFilterChip, dietaryFilter === tag && styles.dietaryFilterChipActive]}
                    onPress={() => setDietaryFilter(dietaryFilter === tag ? null : tag)}
                  >
                    <Text style={styles.dietaryFilterChipText}>{tag}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {filteredSections.map((sec) => (
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
        );
      })()}
      {bringItems.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bring list</Text>
          {(() => {
            const claimed = bringItems.filter((i) => i.status === 'claimed' || i.status === 'provided').length;
            const total = bringItems.length;
            const progress = total > 0 ? claimed / total : 0;
            return (
              <>
                <View style={styles.progressRow}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.tint }]} />
                  </View>
                  <Text style={styles.progressLabel}>{claimed} of {total} claimed</Text>
                </View>
                {bringItems.map((item) => (
                  <View key={item.id}>
                    <BringListItem
                      item={item}
                      eventId={id}
                      guestId={guestId}
                      guestName={guestName}
                      claimedByName={item.claimed_by_guest_id ? guestById().get(item.claimed_by_guest_id)?.guest_name : null}
                      onClaimed={refreshBringItems}
                    />
                    {isHost && item.status === 'claimed' && (
                      <Pressable style={styles.smallBtn} onPress={() => handleMarkProvided(item.id)}>
                        <Text style={[styles.smallBtnText, { color: colors.tint }]}>Mark provided</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </>
            );
          })()}
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
          <Text style={styles.sectionTitle}>RSVP board</Text>
          <View style={styles.rsvpBoardRow}>
            <View style={styles.rsvpCol}>
              <Text style={styles.rsvpColLabel}>Going</Text>
              <View style={styles.avatarRow}>
                {goingGuests.map((g) => (
                  <Avatar key={g.id} initials={initials(g.guest_name)} size={36} />
                ))}
              </View>
            </View>
            <View style={styles.rsvpCol}>
              <Text style={styles.rsvpColLabel}>Running late</Text>
              <View style={styles.avatarRow}>
                {lateGuests.map((g) => (
                  <Avatar key={g.id} initials={initials(g.guest_name)} size={36} />
                ))}
              </View>
            </View>
            <View style={styles.rsvpCol}>
              <Text style={styles.rsvpColLabel}>Maybe</Text>
              <View style={styles.avatarRow}>
                {maybeGuests.map((g) => (
                  <Avatar key={g.id} initials={initials(g.guest_name)} size={36} />
                ))}
              </View>
            </View>
          </View>
          {arrivedGuests.length > 0 && (
            <View style={styles.arrivedRow}>
              <Text style={styles.arrivedLabel}>Here: </Text>
              <View style={styles.avatarRow}>
                {arrivedGuests.map((g) => (
                  <Avatar key={g.id} initials={initials(g.guest_name)} size={28} />
                ))}
              </View>
            </View>
          )}
          {onTheWayGuests.length > 0 && (
            <Text style={styles.onTheWayText}>
              On the way: {onTheWayGuests.map((g) => {
                const eta = (g as EventGuest & { eta_minutes?: number }).eta_minutes;
                return `${g.guest_name}${eta ? ` ~${eta} min` : ''}`;
              }).join(', ')}
            </Text>
          )}
        </View>
      )}
      {isEventOver && (
        <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }, { marginBottom: 16 }]} onPress={() => router.push(`/event/${id}/recap`)}>
          <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>View recap</Text>
        </Pressable>
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
              {!isWeb && (
                <Pressable style={styles.buttonSecondary} onPress={openContactsPicker}>
                  <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Add from contacts</Text>
                </Pressable>
              )}
              {isWeb && (
                <>
                  <Text style={[styles.label, { marginTop: 12 }]}>Or add by phone</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.inputBorder }]}
                    value={invitePhone}
                    onChangeText={setInvitePhone}
                    placeholder="Phone number"
                    placeholderTextColor="#888"
                    keyboardType="phone-pad"
                  />
                  <Text style={styles.label}>Name (optional)</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.inputBorder }]}
                    value={invitePhoneName}
                    onChangeText={setInvitePhoneName}
                    placeholder="Guest name"
                    placeholderTextColor="#888"
                  />
                  <Pressable
                    style={[styles.button, { backgroundColor: colors.primaryButton }, inviteSubmitting && styles.buttonDisabled]}
                    onPress={handleAddGuestByPhone}
                    disabled={inviteSubmitting}
                  >
                    <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{inviteSubmitting ? 'Adding...' : 'Add by phone & send invite'}</Text>
                  </Pressable>
                </>
              )}
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

      <Modal visible={chatVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setChatVisible(false)}>
          <Pressable style={[styles.modalContent, styles.chatModalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Event chat</Text>
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              style={styles.chatList}
              renderItem={({ item }) => (
                <View style={[styles.chatBubble, item.user_id === user?.id ? { alignSelf: 'flex-end', backgroundColor: colors.tint + '30' } : { alignSelf: 'flex-start' }]}>
                  <Text style={styles.chatBody}>{item.body}</Text>
                  <Text style={styles.chatTime}>{new Date(item.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
                </View>
              )}
            />
            <View style={styles.chatInputRow}>
              <TextInput
                style={[styles.chatInput, { borderColor: colors.inputBorder }]}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Message..."
                placeholderTextColor="#888"
                onSubmitEditing={sendMessage}
              />
              <Pressable style={[styles.chatSendBtn, { backgroundColor: colors.primaryButton }, sendingMessage && styles.buttonDisabled]} onPress={sendMessage} disabled={sendingMessage || !newMessage.trim()}>
                <Text style={[styles.chatSendText, { color: colors.primaryButtonText }]}>Send</Text>
              </Pressable>
            </View>
            <Pressable style={styles.modalCancel} onPress={() => setChatVisible(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {isHost && !isWeb && (
        <Modal visible={contactsModalVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => !addingFromContacts && setContactsModalVisible(false)}>
            <Pressable style={[styles.modalContent, styles.contactsModalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Add from contacts</Text>
              {contactsError ? (
                <Text style={styles.errorText}>{contactsError}</Text>
              ) : contactsLoading ? (
                <Text style={styles.body}>Loading contacts...</Text>
              ) : contactsList.length === 0 ? (
                <Text style={styles.body}>No contacts with phone numbers found.</Text>
              ) : (
                <>
                  <FlatList
                    data={contactsList}
                    keyExtractor={(item) => item.id}
                    style={styles.contactsList}
                    renderItem={({ item }) => (
                      <Pressable
                        style={[styles.contactRow, { borderColor: colors.inputBorder }]}
                        onPress={() => toggleContactSelection(item.id)}
                      >
                        <Text style={styles.contactRowName}>{item.name}</Text>
                        <Text style={styles.contactRowPhone}>{item.phone}</Text>
                        <View style={[styles.checkbox, selectedContactIds.has(item.id) && { backgroundColor: colors.tint }]} />
                      </Pressable>
                    )}
                  />
                  <Pressable
                    style={[styles.button, { backgroundColor: colors.primaryButton }, (addingFromContacts || selectedContactIds.size === 0) && styles.buttonDisabled]}
                    onPress={handleAddSelectedFromContacts}
                    disabled={addingFromContacts || selectedContactIds.size === 0}
                  >
                    <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>
                      {addingFromContacts ? 'Adding...' : `Add selected (${selectedContactIds.size})`}
                    </Text>
                  </Pressable>
                </>
              )}
              <Pressable style={styles.modalCancel} onPress={() => !addingFromContacts && setContactsModalVisible(false)}>
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
  rsvpBoardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  rsvpCol: { minWidth: 80 },
  rsvpColLabel: { fontSize: 12, fontWeight: '600', opacity: 0.8, marginBottom: 6 },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  arrivedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  arrivedLabel: { fontSize: 13, fontWeight: '500', marginRight: 6 },
  onTheWayText: { fontSize: 13, opacity: 0.85, marginTop: 8 },
  arrivalNotesCard: { padding: 12, borderRadius: 8, borderWidth: 1, marginVertical: 8 },
  arrivalNotesLabel: { fontSize: 12, fontWeight: '600', opacity: 0.9, marginBottom: 4 },
  arrivalNotesText: { fontSize: 14 },
  etaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 },
  etaLabel: { fontSize: 14 },
  etaBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  etaBtnText: { fontSize: 13, fontWeight: '500' },
  inEventBanner: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  inEventTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  quickActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  quickActionChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  quickActionChipText: { fontSize: 14, fontWeight: '600' },
  chatModalContent: { maxHeight: '80%', minHeight: 300 },
  chatList: { maxHeight: 240, marginBottom: 12 },
  chatBubble: { maxWidth: '85%', padding: 10, borderRadius: 12, marginBottom: 6 },
  chatBody: { fontSize: 15 },
  chatTime: { fontSize: 11, opacity: 0.7, marginTop: 4 },
  chatInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chatInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  chatSendBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  chatSendText: { fontWeight: '600' },
  accentBar: { height: 4, marginBottom: 12, borderRadius: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  dietaryFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dietaryFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(128,128,128,0.2)' },
  dietaryFilterChipActive: { backgroundColor: 'rgba(0,0,0,0.15)' },
  dietaryFilterChipText: { fontSize: 13, fontWeight: '500' },
  progressRow: { marginBottom: 12 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 12, opacity: 0.8, marginTop: 4 },
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
  contactsModalContent: { maxHeight: '80%' },
  contactsList: { maxHeight: 280, marginBottom: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  contactRowName: { flex: 1, fontSize: 16, fontWeight: '500' },
  contactRowPhone: { fontSize: 14, opacity: 0.8, marginRight: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#888' },
});

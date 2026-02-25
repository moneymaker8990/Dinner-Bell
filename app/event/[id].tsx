import { AnimatedCountdown } from '@/components/AnimatedCountdown';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { AppBottomSheet } from '@/components/AppBottomSheet';
import { Avatar } from '@/components/Avatar';
import { BringListItem } from '@/components/BringListItem';
import { Card, CardBody } from '@/components/Card';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { GradientHeader } from '@/components/GradientHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { RingBellButton } from '@/components/RingBellButton';
import { SkeletonCardList } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { lineHeight, radius, spacing, typography } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useEvent, useInvalidateEvent } from '@/hooks/useEvent';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
    trackCalendarAdded,
    trackChatMessageSent,
    trackEventCancelled,
    trackGuestAdded,
    trackMapsOpened,
    trackScreenViewed,
} from '@/lib/analytics';
import { addEventToCalendar } from '@/lib/calendar';
import { createDemoEvent } from '@/lib/demoEvent';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { addGuestByHost, addGuestByHostPhone, normalizePhoneForLookup, sendInviteEmail, sendInvitePush, sendInvitePushByPhone, sendInviteSms } from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import { useContactsPicker } from '@/lib/useContactsPicker';
import { buildEventUrl, buildInviteUrl } from '@/lib/urls';
import type { BringItemRow, EventGuest, EventWithDetails, MenuItemRow, MenuSection, ScheduleBlockRow } from '@/types/events';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, TextInput } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
  if (diff <= 0) return Copy.event.bellTimePassed;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

function fullAddress(e: EventWithDetails): string {
  const parts = [e.address_line1, e.address_line2, e.city, e.state, e.postal_code, e.country].filter(Boolean);
  return parts.join(', ');
}

type ChatMessageItemProps = {
  item: { id: string; user_id: string; body: string; created_at: string };
  currentUserId: string | undefined;
  tintColor: string;
};

const ChatMessageItem = React.memo(function ChatMessageItem({
  item,
  currentUserId,
  tintColor,
}: ChatMessageItemProps) {
  return (
    <View style={[styles.chatBubble, item.user_id === currentUserId ? { alignSelf: 'flex-end', backgroundColor: tintColor + '30' } : { alignSelf: 'flex-start' }]}>
      <Text style={styles.chatBody}>{item.body}</Text>
      <Text style={styles.chatTime}>{new Date(item.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
    </View>
  );
});

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string; guestId?: string }>();
  const id = params.id;
  const urlGuestId = params.guestId;
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion();
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
  const [addingFromContacts, setAddingFromContacts] = useState(false);
  const contactsPicker = useContactsPicker();
  const [dietaryFilter, setDietaryFilter] = useState<string | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [messages, setMessages] = useState<{ id: string; user_id: string; body: string; created_at: string }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [providedCelebrationVisible, setProvidedCelebrationVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const bringListCompleteShown = useRef(false);
  const inviteSheetRef = useRef<GorhomBottomSheet>(null);
  const chatSheetRef = useRef<GorhomBottomSheet>(null);
  const contactsSheetRef = useRef<GorhomBottomSheet>(null);

  const { data: eventData, isLoading: queryLoading, error: queryError } = useEvent(
    id !== '__demo__' && user ? id : undefined,
    user?.id
  );
  const invalidateEvent = useInvalidateEvent();

  const toast = useToast();
  const guestById = useMemo(() => {
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
    trackScreenViewed('EventDetail');
  }, []);

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
        const { data: full, error: rpcError } = await supabase.rpc('get_event_full_for_guest', {
          p_event_id: id,
          p_guest_id: urlGuestId,
        });
        if (rpcError || !full) {
          setError(Copy.event.notFound);
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

      // If React Query has data for this event, use it
      if (eventData && user) {
        setEvent(eventData.event);
        setMenuSections(eventData.menuSections);
        setBringItems(eventData.bringItems);
        setScheduleBlocks(eventData.scheduleBlocks);
        setGuests(eventData.guests);
        setHostName(eventData.hostName);
        setCoHostIds(eventData.coHostIds);
        // Find current guest
        const me = eventData.guests.find((g) => g.user_id === user.id) ?? eventData.guests.find((g) => g.guest_phone_or_email === user.email);
        setCurrentGuest(me ?? null);
        setLoading(false);
        return;
      }

      const { data: rawEventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      if (rawEventData && (rawEventData as EventWithDetails).is_cancelled) {
        setError(Copy.event.cancelled);
        setLoading(false);
        return;
      }
      if (eventError || !rawEventData) {
        setError(Copy.event.notFound);
        setLoading(false);
        return;
      }
      setEvent(rawEventData as EventWithDetails);
      const { data: hostProfile } = await supabase.from('profiles').select('name').eq('id', (rawEventData as EventWithDetails).host_user_id).single();
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
  }, [id, user?.id ?? null, urlGuestId, eventData, reloadToken]);

  useEffect(() => {
    if (!loading) setRefreshing(false);
  }, [loading]);

  useEffect(() => {
    if (!id || id === '__demo__') return;
    const channel = supabase
      .channel(`bring_items:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bring_items', filter: `event_id=eq.${id}` }, () => {
        supabase.from('bring_items').select('*').eq('event_id', id).order('sort_order').then(({ data }) => setBringItems(data ?? []));
        invalidateEvent(id);
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
        invalidateEvent(id);
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
      toast.show(Copy.toast.bringListComplete);
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
    const { error } = await supabase.from('event_messages').insert({ event_id: id, user_id: user.id, body: newMessage.trim() });
    setNewMessage('');
    setSendingMessage(false);
    if (!error) trackChatMessageSent(id);
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
    trackMapsOpened(id);
  };

  const handleArrived = () => {
    if (!guestId || isHost) return;
    hapticTap();
    supabase.from('event_guests').update({ arrival_status: 'arrived', arrived_at: new Date().toISOString() }).eq('id', guestId).then(() => {
      supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
    });
    toast.show(Copy.toast.youreHere);
  };

  const handleShare = async () => {
    if (!event?.invite_token) return;
    const url = buildInviteUrl(id, event.invite_token);
    try {
      await Share.share({ message: Copy.event.inviteShareMessage(event.title, url), url });
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
      url: buildEventUrl(id),
    });
    trackCalendarAdded(id, result.ok);
    if (result.ok) toast.show(Copy.toast.addedToCalendar);
    else toast.show(result.message ?? Copy.toast.calendarFailed);
  };

  const handleMarkProvided = async (itemId: string) => {
    const { error: updateError } = await supabase
      .from('bring_items')
      .update({ status: 'provided' })
      .eq('id', itemId);
    if (updateError) {
      toast.show(Copy.validation.genericError);
      return;
    }
    refreshBringItems();
    hapticSuccess();
    toast.show(Copy.toast.itemMarkedProvided);
    setProvidedCelebrationVisible(true);
  };

  const refreshBringItems = () => {
    if (!id || id === '__demo__') return;
    supabase.from('bring_items').select('*').eq('event_id', id).order('sort_order').then(({ data }) => setBringItems(data ?? []));
  };

  const handleCancelEvent = () => {
    if (!id || !event || !isHost) return;
    Alert.alert(
      Copy.event.cancelEventTitle,
      Copy.event.cancelEventBody,
      [
        { text: Copy.event.keepEvent, style: 'cancel' },
        {
          text: Copy.event.cancelEventTitle,
          style: 'destructive',
          onPress: () => {
            supabase.from('events').update({ is_cancelled: true }).eq('id', id).eq('host_user_id', user!.id).then(({ error }) => {
              if (!error) {
                trackEventCancelled(id);
                invalidateEvent(id);
                router.replace('/(tabs)');
              }
            });
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setLoading(true);
    setError(null);
    if (id && id !== '__demo__') invalidateEvent(id);
    setReloadToken((v) => v + 1);
  };

  const openInviteModal = () => {
    setInviteEmail('');
    setInviteName('');
    setInvitePhone('');
    setInvitePhoneName('');
    setInviteError(null);
    setInviteModalVisible(true);
    inviteSheetRef.current?.snapToIndex(0);
  };

  const handleAddSelectedFromContacts = async () => {
    if (!id || contactsPicker.selectedIds.size === 0) return;
    setAddingFromContacts(true);
    let added = 0;
    let failed = 0;
    let deliveryFailed = 0;
    let lastError: string | null = null;
    for (const contact of contactsPicker.contactsList) {
      if (!contactsPicker.selectedIds.has(contact.id)) continue;
      if (contact.type === 'email') {
        const result = await addGuestByHost(id, contact.value, contact.name);
        if (result.data) {
          added += 1;
          const emailSent = await sendInviteEmail(id, contact.value, contact.name);
          if (!emailSent) deliveryFailed += 1;
          await sendInvitePush(id, contact.value);
        } else {
          failed += 1;
          lastError = result.error ?? lastError;
        }
      } else {
        const result = await addGuestByHostPhone(id, contact.value, contact.name);
        if (result.data) {
          added += 1;
          const smsSent = await sendInviteSms(id, contact.value, contact.name);
          if (!smsSent) deliveryFailed += 1;
          await sendInvitePushByPhone(id, contact.value);
        } else {
          failed += 1;
          lastError = result.error ?? lastError;
        }
      }
    }
    setAddingFromContacts(false);
    contactsPicker.setModalVisible(false);
    contactsSheetRef.current?.close();
    contactsPicker.setSelectedIds(new Set());
    supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
    invalidateEvent(id);
    if (added > 0) trackGuestAdded(id, 'contacts');
    if (failed > 0) setInviteError(lastError ?? `${failed} invite${failed === 1 ? '' : 's'} could not be sent.`);
    else if (deliveryFailed > 0) setInviteError(Copy.validation.inviteDeliveryFailed(deliveryFailed));
    toast.show(added > 0 ? Copy.toast.guestsAdded(added) : Copy.toast.noGuestsAdded);
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
    const result = await addGuestByHostPhone(id, normalized, invitePhoneName.trim() || undefined);
    if (result.data) {
      const smsSent = await sendInviteSms(id, normalized, invitePhoneName.trim() || undefined);
      await sendInvitePushByPhone(id, normalized);
      trackGuestAdded(id, 'phone');
      setInvitePhone('');
      setInvitePhoneName('');
      supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
      invalidateEvent(id);
      if (!smsSent) setInviteError(Copy.validation.inviteDeliveryFailed(1));
      toast.show(Copy.toast.guestAdded);
    } else {
      setInviteError(result.error ?? 'Could not add guest');
    }
    setInviteSubmitting(false);
  };

  const handleAddGuestByEmail = async () => {
    if (!id || !inviteEmail.trim()) {
      setInviteError(Copy.event.enterEmail);
      return;
    }
    setInviteSubmitting(true);
    setInviteError(null);
    const result = await addGuestByHost(id, inviteEmail.trim(), inviteName.trim() || undefined);
    if (result.data) {
      const emailSent = await sendInviteEmail(id, inviteEmail.trim(), inviteName.trim() || undefined);
      await sendInvitePush(id, inviteEmail.trim());
      trackGuestAdded(id, 'email');
      setInviteEmail('');
      setInviteName('');
      supabase.from('event_guests').select('*').eq('event_id', id).then(({ data }) => setGuests(data ?? []));
      invalidateEvent(id);
      if (!emailSent) setInviteError(Copy.validation.inviteDeliveryFailed(1));
    } else {
      setInviteError(result.error ?? 'Could not add guest');
    }
    setInviteSubmitting(false);
  };

  const handleShareFromModal = async () => {
    if (!event?.invite_token) return;
    const url = buildInviteUrl(id, event.invite_token);
    try {
      await Share.share({ message: `You're invited to ${event.title}. RSVP: ${url}`, url });
    } catch (_) {}
    setInviteModalVisible(false);
    inviteSheetRef.current?.close();
  };

  const handleCopyInviteLink = async () => {
    if (!event?.invite_token) return;
    const url = buildInviteUrl(id, event.invite_token);
    await Clipboard.setStringAsync(url);
    toast.show(Copy.event.inviteLinkCopied);
  };

  const goingGuests = useMemo(() => guests.filter((g) => g.rsvp_status === 'going'), [guests]);
  const lateGuests = useMemo(() => guests.filter((g) => g.rsvp_status === 'late'), [guests]);
  const maybeGuests = useMemo(() => guests.filter((g) => g.rsvp_status === 'maybe'), [guests]);
  const arrivedGuests = useMemo(() => guests.filter((g) => (g as EventGuest & { arrived_at?: string }).arrived_at), [guests]);
  const onTheWayGuests = useMemo(() => guests.filter((g) => (g as EventGuest & { arrival_status?: string }).arrival_status === 'on_the_way'), [guests]);

  const allTags = useMemo(
    () => Array.from(new Set(menuSections.flatMap((s) => s.menu_items.flatMap((i) => i.dietary_tags ?? [])))),
    [menuSections],
  );
  const filteredSections = useMemo(
    () =>
      dietaryFilter
        ? menuSections
            .map((sec) => ({
              ...sec,
              menu_items: sec.menu_items.filter((i) => (i.dietary_tags ?? []).includes(dietaryFilter)),
            }))
            .filter((sec) => sec.menu_items.length > 0)
        : menuSections,
    [menuSections, dietaryFilter],
  );

  if (loading) {
    return (
      <View style={[styles.container, { padding: spacing.lg }]}>
        <SkeletonCardList count={2} />
      </View>
    );
  }
  if (error || !event) {
    return (
      <View style={[styles.container, styles.centered, { padding: spacing.xl }]}>
        <Card style={{ width: '100%', maxWidth: 560 }}>
          <CardBody>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
              <Text style={[styles.errorTitle, { color: colors.textPrimary }]} accessibilityRole="header">{error ?? Copy.event.notFound}</Text>
              <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{Copy.event.notFoundBody}</Text>
              <AnimatedPressable
                style={[styles.button, { backgroundColor: colors.primaryButton }]}
                onPress={handleRefresh}
                accessibilityRole="button"
                accessibilityLabel="Retry loading event"
              >
                <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{Copy.offline.retry}</Text>
              </AnimatedPressable>
            </View>
          </CardBody>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CelebrationOverlay
        visible={providedCelebrationVisible}
        headline="Marked provided"
        subtitle="Bring list updated"
        displayDuration={1200}
        onFinish={() => setProvidedCelebrationVisible(false)}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.tint} />}
      >
      <GradientHeader
        title={event.title}
        subtitle={hostName ? Copy.event.hostedBy(hostName) : undefined}
        onBack={() => router.back()}
        showBrandLogo
        height={200}
        coverImageUrl={event?.cover_image_url}
      >
        <AnimatedCountdown bellTime={event.bell_time} compact />
      </GradientHeader>
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(400)} style={styles.content}>
      {isInEventWindow && (
        <View style={[styles.inEventBanner, { backgroundColor: colors.tintFaint, borderColor: colors.tintBorder }]}>
          <Text style={styles.inEventTitle} accessibilityRole="header">{isPastBell ? Copy.event.dinnerIsOn : Copy.event.bellIn(formatCountdown(event.bell_time))}</Text>
          <View style={styles.quickActionsRow}>
            {isHostOrCoHost && (
              <RingBellButton eventId={event.id} bellSound={(event as EventWithDetails & { bell_sound?: string }).bell_sound} />
            )}
            {(user && (isHost || guestId)) && (
              <Pressable style={[styles.quickActionChip, { borderColor: colors.tint }]} onPress={() => { setChatVisible(true); chatSheetRef.current?.snapToIndex(0); }} accessibilityRole="button" accessibilityLabel="Open event chat">
                <Text style={[styles.quickActionChipText, { color: colors.tint }]}>{Copy.event.openChat}</Text>
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
          <AnimatedPressable variant="primary" enableHaptics style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={() => router.push(`/event/${id}/edit`)} accessibilityRole="button" accessibilityLabel="Edit event">
            <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{Copy.event.editEvent}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.buttonSecondary} onPress={openInviteModal} accessibilityRole="button" accessibilityLabel={Copy.event.inviteMore}>
            <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>{Copy.event.inviteMore}</Text>
          </AnimatedPressable>
          {!isWeb && (
            <AnimatedPressable style={styles.buttonSecondary} onPress={() => { contactsPicker.openPicker(); contactsSheetRef.current?.snapToIndex(0); }} accessibilityRole="button" accessibilityLabel="Add from contacts">
              <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>{Copy.common.addFromContacts}</Text>
            </AnimatedPressable>
          )}
          {isHost && (
            <AnimatedPressable style={styles.cancelEventBtn} onPress={handleCancelEvent} accessibilityRole="button" accessibilityLabel="Cancel event">
              <Text style={[styles.cancelEventText, { color: colors.error }]}>{Copy.event.cancelEvent}</Text>
            </AnimatedPressable>
          )}
        </View>
      )}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{Copy.common.location}</Text>
        <Text style={styles.body}>{fullAddress(event)}</Text>
        {event.location_notes ? (
          <View style={[styles.arrivalNotesCard, { backgroundColor: colors.tintFaint, borderColor: colors.tintBorder }]}>
            <Text style={styles.arrivalNotesLabel}>{Copy.event.arrivalNotes}</Text>
            <Text style={styles.arrivalNotesText}>{event.location_notes}</Text>
          </View>
        ) : null}
        <AnimatedPressable variant="primary" enableHaptics style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={handleNavigate} accessibilityRole="button" accessibilityLabel="Open location in maps">
          <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{Copy.common.navigate}</Text>
        </AnimatedPressable>
        {!isHost && guestId && (currentGuest as EventGuest & { arrival_status?: string })?.arrival_status !== 'arrived' && (
          <>
            <View style={styles.etaRow}>
              <Text style={styles.etaLabel}>{Copy.event.imOnMyWay}</Text>
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
                  accessibilityRole="button"
                  accessibilityLabel={`Set ETA to ${mins} minutes`}
                >
                  <Text style={[styles.etaBtnText, { color: colors.tint }]}>{mins}{Copy.event.minAway}</Text>
                </Pressable>
              ))}
            </View>
            <AnimatedPressable style={[styles.buttonSecondary, { marginTop: spacing.sm }]} onPress={handleArrived} accessibilityRole="button" accessibilityLabel="I've arrived">
              <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>{Copy.event.iveArrived}</Text>
            </AnimatedPressable>
          </>
        )}
        <AnimatedPressable style={styles.buttonSecondary} onPress={handleCopyAddress} accessibilityRole="button" accessibilityLabel="Copy address">
          <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>{Copy.common.copyAddress}</Text>
        </AnimatedPressable>
        <AnimatedPressable style={styles.buttonSecondary} onPress={handleAddToCalendar} accessibilityRole="button" accessibilityLabel="Add event to calendar">
          <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>{Copy.common.addToCalendar}</Text>
        </AnimatedPressable>
      </View>
      {menuSections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{Copy.common.menu}</Text>
            {allTags.length > 0 && (
              <View style={styles.dietaryFilterRow}>
                <Pressable
                  style={[styles.dietaryFilterChip, { backgroundColor: colors.border }, !dietaryFilter && styles.dietaryFilterChipActive]}
                  onPress={() => setDietaryFilter(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Show all menu items"
                >
                  <Text style={[styles.dietaryFilterChipText, { color: colors.textPrimary }]}>All</Text>
                </Pressable>
                {allTags.map((tag) => (
                  <Pressable
                    key={tag}
                    style={[styles.dietaryFilterChip, { backgroundColor: colors.border }, dietaryFilter === tag && styles.dietaryFilterChipActive]}
                    onPress={() => setDietaryFilter(dietaryFilter === tag ? null : tag)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${tag}`}
                  >
                    <Text style={[styles.dietaryFilterChipText, { color: colors.textPrimary }]}>{tag}</Text>
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
                            style={[styles.dietaryChip, { backgroundColor: colors.accentSageFaint, borderColor: colors.accentSageBorder }]}>
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
          <Text style={styles.sectionTitle} accessibilityRole="header">{Copy.common.bringList}</Text>
          {(() => {
            const claimed = bringItems.filter((i) => i.status === 'claimed' || i.status === 'provided').length;
            const total = bringItems.length;
            const progress = total > 0 ? claimed / total : 0;
            return (
              <>
                <ProgressBar
                  progress={progress}
                  label={Copy.event.ofClaimed(claimed, total)}
                  showPercent
                />
                {bringItems.map((item) => (
                  <View key={item.id}>
                    <BringListItem
                      item={item}
                      eventId={id}
                      guestId={guestId}
                      guestName={guestName}
                      claimedByName={item.claimed_by_guest_id ? guestById.get(item.claimed_by_guest_id)?.guest_name : null}
                      onClaimed={refreshBringItems}
                    />
                    {isHost && item.status === 'claimed' && (
                      <Pressable style={styles.smallBtn} onPress={() => handleMarkProvided(item.id)} accessibilityRole="button" accessibilityLabel="Mark provided">
                        <Text style={[styles.smallBtnText, { color: colors.tint }]}>{Copy.event.markProvided}</Text>
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
          <Text style={styles.sectionTitle} accessibilityRole="header">{Copy.common.schedule}</Text>
          {scheduleBlocks.map((block) => (
            <Text key={block.id} style={styles.body}>
              {block.time ? new Date(block.time).toLocaleTimeString() : '—'} {block.title}
            </Text>
          ))}
        </View>
      )}
      {isHost && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">{Copy.common.rsvpBoard}</Text>
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
              <Text style={styles.rsvpColLabel}>{Copy.event.runningLate}</Text>
              <View style={styles.avatarRow}>
                {lateGuests.map((g) => (
                  <Avatar key={g.id} initials={initials(g.guest_name)} size={36} />
                ))}
              </View>
            </View>
            <View style={styles.rsvpCol}>
              <Text style={styles.rsvpColLabel}>{Copy.event.maybe}</Text>
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
              {Copy.event.onTheWay}{onTheWayGuests.map((g) => {
                const eta = (g as EventGuest & { eta_minutes?: number }).eta_minutes;
                return `${g.guest_name}${eta ? ` ~${eta} min` : ''}`;
              }).join(', ')}
            </Text>
          )}
        </View>
      )}
      {isEventOver && (
          <AnimatedPressable style={[styles.button, { backgroundColor: colors.primaryButton }, { marginBottom: spacing.lg }]} onPress={() => router.push(`/event/${id}/recap`)} accessibilityRole="button" accessibilityLabel={Copy.event.viewRecap}>
          <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{Copy.event.viewRecap}</Text>
        </AnimatedPressable>
      )}
      {!isHost && (
        <View style={styles.guestShareRow}>
          <AnimatedPressable style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share event">
            <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{Copy.common.shareLink}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.buttonSecondary} onPress={handleCopyInviteLink} accessibilityRole="button" accessibilityLabel="Copy invite link">
            <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Copy invite link</Text>
          </AnimatedPressable>
        </View>
      )}

      {isHost && (
        <AppBottomSheet
          ref={inviteSheetRef}
          snapPoints={['70%', '90%']}
          index={inviteModalVisible ? 0 : -1}
          onClose={() => setInviteModalVisible(false)}
          title="Invite more"
          scrollable
        >
              <FloatingLabelInput
                label={Copy.placeholder.email}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                onClear={() => setInviteEmail('')}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                autoComplete="email"
                style={{ marginBottom: spacing.md }}
              />
              <FloatingLabelInput
                label={Copy.placeholder.guestName}
                value={inviteName}
                onChangeText={setInviteName}
                onClear={() => setInviteName('')}
                returnKeyType="done"
                autoComplete="name"
                autoCapitalize="words"
                style={{ marginBottom: spacing.md }}
              />
              {inviteError ? <Text style={[styles.errorText, { color: colors.error }]}>{inviteError}</Text> : null}
              <AnimatedPressable
                variant="primary"
                enableHaptics
                style={[styles.button, { backgroundColor: colors.primaryButton }, inviteSubmitting && styles.buttonDisabled]}
                onPress={handleAddGuestByEmail}
                disabled={inviteSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Send email invite"
              >
                <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{inviteSubmitting ? Copy.common.adding : Copy.event.addAndSendInvite}</Text>
              </AnimatedPressable>
              {!isWeb && (
                <Text style={[styles.body, { marginBottom: spacing.sm }]}>Invite from your contacts. We will text or email them the invite.</Text>
              )}
              {!isWeb && (
                <AnimatedPressable style={styles.buttonSecondary} onPress={() => { contactsPicker.openPicker(); contactsSheetRef.current?.snapToIndex(0); }} accessibilityRole="button" accessibilityLabel="Add from contacts">
                  <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>{Copy.common.addFromContacts}</Text>
                </AnimatedPressable>
              )}
              <>
                <FloatingLabelInput
                  label="Phone number"
                  value={invitePhone}
                  onChangeText={setInvitePhone}
                  onClear={() => setInvitePhone('')}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  autoComplete="tel"
                  autoCapitalize="none"
                  style={{ marginTop: spacing.md, marginBottom: spacing.md }}
                />
                <FloatingLabelInput
                  label={Copy.placeholder.guestName}
                  value={invitePhoneName}
                  onChangeText={setInvitePhoneName}
                  onClear={() => setInvitePhoneName('')}
                  returnKeyType="done"
                  autoComplete="name"
                  autoCapitalize="words"
                  style={{ marginBottom: spacing.md }}
                />
                <AnimatedPressable
                  variant="primary"
                  enableHaptics
                  style={[styles.button, { backgroundColor: colors.primaryButton }, inviteSubmitting && styles.buttonDisabled]}
                  onPress={handleAddGuestByPhone}
                  disabled={inviteSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Send phone invite"
                >
                  <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{inviteSubmitting ? Copy.common.adding : Copy.event.addByPhoneAndSend}</Text>
                </AnimatedPressable>
              </>
              <AnimatedPressable style={styles.buttonSecondary} onPress={handleShareFromModal} accessibilityRole="button" accessibilityLabel="Share event">
                <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>{Copy.event.shareLinkInstead}</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.buttonSecondary} onPress={handleCopyInviteLink} accessibilityRole="button" accessibilityLabel="Copy invite link">
                <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>{Copy.common.copyInviteLink}</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.modalCancel} onPress={() => { inviteSheetRef.current?.close(); setInviteModalVisible(false); }} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={styles.modalCancelText}>{Copy.common.cancel}</Text>
              </AnimatedPressable>
        </AppBottomSheet>
      )}

      <AppBottomSheet
        ref={chatSheetRef}
        snapPoints={['60%', '90%']}
        index={chatVisible ? 0 : -1}
        onClose={() => setChatVisible(false)}
        title="Event chat"
        scrollable
      >
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              style={styles.chatList}
              getItemLayout={(_data, index) => ({ length: 64, offset: 64 * index, index })}
              ListEmptyComponent={<Text style={[styles.chatEmptyText, { color: colors.textSecondary }]}>{Copy.event.chatEmpty}</Text>}
              renderItem={({ item }) => (
                <ChatMessageItem item={item} currentUserId={user?.id} tintColor={colors.tint} />
              )}
            />
            <View style={styles.chatInputRow}>
              <TextInput
                style={[styles.chatInput, { borderColor: colors.inputBorder }]}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder={Copy.placeholder.chatMessage}
                placeholderTextColor={colors.placeholder}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <AnimatedPressable style={[styles.chatSendBtn, { backgroundColor: colors.primaryButton }, sendingMessage && styles.buttonDisabled]} onPress={sendMessage} disabled={sendingMessage || !newMessage.trim()} accessibilityRole="button" accessibilityLabel="Send message">
                <Text style={[styles.chatSendText, { color: colors.primaryButtonText }]}>{Copy.common.send}</Text>
              </AnimatedPressable>
            </View>
            <AnimatedPressable style={styles.modalCancel} onPress={() => { chatSheetRef.current?.close(); setChatVisible(false); }} accessibilityRole="button" accessibilityLabel="Close chat">
              <Text style={styles.modalCancelText}>{Copy.common.close}</Text>
            </AnimatedPressable>
      </AppBottomSheet>

      {isHost && !isWeb && (
        <AppBottomSheet
          ref={contactsSheetRef}
          snapPoints={['60%', '85%']}
          index={contactsPicker.modalVisible ? 0 : -1}
          onClose={() => { if (!addingFromContacts) contactsPicker.setModalVisible(false); }}
          title="Add from contacts"
          scrollable
        >
              {contactsPicker.contactsError ? (
                <Text style={[styles.errorText, { color: colors.error }]}>{contactsPicker.contactsError}</Text>
              ) : contactsPicker.contactsLoading ? (
                <Text style={styles.body}>{Copy.common.loadingContacts}</Text>
              ) : contactsPicker.contactsList.length === 0 ? (
                <Text style={styles.body}>{Copy.common.noContactsFound}</Text>
              ) : (
                <>
                  <FlatList
                    data={contactsPicker.contactsList}
                    keyExtractor={(item) => item.id}
                    style={styles.contactsList}
                    getItemLayout={(_data, index) => ({ length: 56, offset: 56 * index, index })}
                    renderItem={({ item }) => (
                      <Pressable
                        style={[styles.contactRow, { borderColor: colors.inputBorder }]}
                        onPress={() => contactsPicker.toggleSelection(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${item.name} for invite`}
                      >
                        <Text style={styles.contactRowName}>{item.name}</Text>
                        <Text style={styles.contactRowPhone}>{item.value}</Text>
                        <View style={[styles.checkbox, { borderColor: colors.border }, contactsPicker.selectedIds.has(item.id) && { backgroundColor: colors.tint }]} />
                      </Pressable>
                    )}
                  />
                  <AnimatedPressable
                    style={[styles.button, { backgroundColor: colors.primaryButton }, (addingFromContacts || contactsPicker.selectedIds.size === 0) && styles.buttonDisabled]}
                    onPress={handleAddSelectedFromContacts}
                    disabled={addingFromContacts || contactsPicker.selectedIds.size === 0}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${contactsPicker.selectedIds.size} selected contacts`}
                  >
                    <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>
                      {addingFromContacts ? Copy.common.adding : Copy.common.addSelected(contactsPicker.selectedIds.size)}
                    </Text>
                  </AnimatedPressable>
                </>
              )}
              <AnimatedPressable style={styles.modalCancel} onPress={() => { if (!addingFromContacts) { contactsSheetRef.current?.close(); contactsPicker.setModalVisible(false); } }} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={styles.modalCancelText}>{Copy.common.cancel}</Text>
              </AnimatedPressable>
        </AppBottomSheet>
      )}
      </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl + spacing.sm },
  content: { padding: spacing.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl + spacing.xl + spacing.xs },
  errorTitle: { fontSize: typography.headline, fontWeight: '600', textAlign: 'center', marginBottom: spacing.sm },
  errorBody: { fontSize: typography.body, textAlign: 'center', lineHeight: lineHeight.meta },
  /* title, hostName, countdown moved into GradientHeader */
  hostActions: { marginBottom: spacing.lg },
  cancelEventBtn: { padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
  cancelEventText: { fontSize: typography.meta, fontWeight: '500' },
  section: { marginBottom: spacing.xl },
  rsvpBoardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.sm },
  rsvpCol: { minWidth: 80 },
  rsvpColLabel: { fontSize: typography.microLabel, fontWeight: '600', opacity: 0.8, marginBottom: spacing.xs + 2 },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  arrivedRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  arrivedLabel: { fontSize: typography.microLabel, fontWeight: '500', marginRight: spacing.xs + 2 },
  onTheWayText: { fontSize: typography.microLabel, opacity: 0.85, marginTop: spacing.sm },
  arrivalNotesCard: { padding: spacing.md, borderRadius: spacing.sm, borderWidth: 1, marginVertical: spacing.sm },
  arrivalNotesLabel: { fontSize: typography.microLabel, fontWeight: '600', opacity: 0.9, marginBottom: spacing.xs },
  arrivalNotesText: { fontSize: typography.meta },
  etaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  etaLabel: { fontSize: typography.meta },
  etaBtn: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md, borderRadius: spacing.sm, borderWidth: 1 },
  etaBtnText: { fontSize: typography.microLabel, fontWeight: '500' },
  inEventBanner: { padding: spacing.lg, borderRadius: radius.input, borderWidth: 1, marginBottom: spacing.lg },
  inEventTitle: { fontSize: typography.headline, fontWeight: '600', marginBottom: spacing.md },
  quickActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' },
  quickActionChip: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, borderRadius: spacing.sm, borderWidth: 1 },
  quickActionChipText: { fontSize: typography.meta, fontWeight: '600' },
  chatModalContent: { maxHeight: '80%', minHeight: 300 },
  chatList: { maxHeight: 240, marginBottom: spacing.md },
  chatEmptyText: { fontSize: typography.meta, textAlign: 'center', paddingVertical: spacing.xl, opacity: 0.7 },
  chatBubble: { maxWidth: '85%', padding: spacing.sm + 2, borderRadius: radius.input, marginBottom: spacing.xs + 2 },
  chatBody: { fontSize: typography.body },
  chatTime: { fontSize: typography.microLabel, opacity: 0.7, marginTop: spacing.xs },
  chatInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  chatInput: { flex: 1, borderWidth: 1, borderRadius: spacing.sm, padding: spacing.md, fontSize: typography.body },
  chatSendBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: spacing.sm },
  chatSendText: { fontWeight: '600' },
  /* accentBar replaced by GradientHeader */
  sectionTitle: { fontSize: typography.headline, fontWeight: '600', marginBottom: spacing.sm },
  dietaryFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  dietaryFilterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: spacing.lg, opacity: 0.6 },
  dietaryFilterChipActive: { opacity: 1 },
  dietaryFilterChipText: { fontSize: typography.microLabel, fontWeight: '500' },
  /* progressRow/Track/Fill/Label replaced by ProgressBar component */
  subsectionTitle: { fontSize: typography.body, fontWeight: '500', marginTop: spacing.sm, marginBottom: spacing.xs },
  menuItemRow: { marginBottom: spacing.xs + 2 },
  dietaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginTop: spacing.xs, marginLeft: spacing.lg },
  dietaryChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: spacing.xs + 2, borderWidth: 1 },
  dietaryChipText: { fontSize: typography.microLabel, fontWeight: '500' },
  body: { fontSize: typography.meta, marginBottom: spacing.xs },
  notes: { fontSize: typography.meta, opacity: 0.8, marginTop: spacing.xs },
  button: { padding: spacing.lg, borderRadius: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { fontWeight: '600' },
  buttonSecondary: { padding: spacing.lg, alignItems: 'center', marginTop: spacing.xs },
  buttonSecondaryText: { fontWeight: '600' },
  guestShareRow: { marginTop: spacing.sm },
  smallBtn: { padding: spacing.sm, minHeight: 44, justifyContent: 'center', alignItems: 'flex-start', marginTop: spacing.xs },
  smallBtnText: { fontSize: typography.meta, fontWeight: '500' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modalContent: { borderRadius: spacing.lg, padding: spacing.xl, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: typography.headline, fontWeight: '600', marginBottom: spacing.lg },
  label: { fontSize: typography.meta, fontWeight: '500', marginBottom: spacing.xs + 2 },
  input: { borderWidth: 1, borderRadius: spacing.sm, padding: spacing.md, fontSize: typography.body, marginBottom: spacing.md },
  errorText: { marginBottom: spacing.sm },
  buttonDisabled: { opacity: 0.6 },
  modalCancel: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  modalCancelText: { fontWeight: '500' },
  contactsModalContent: { maxHeight: '80%' },
  contactsList: { maxHeight: 280, marginBottom: spacing.md },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1 },
  contactRowName: { flex: 1, fontSize: typography.body, fontWeight: '500' },
  contactRowPhone: { fontSize: typography.meta, opacity: 0.8, marginRight: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: radius.md, borderWidth: 2 },
});

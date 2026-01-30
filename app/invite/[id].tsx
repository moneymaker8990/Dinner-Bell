import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { hapticRsvp } from '@/lib/haptics';
import { addGuestByInvite, getInvitePreview, type EventByInvite, type InvitePreview } from '@/lib/invite';
import { notifyHostRsvpChange } from '@/lib/notifyHost';
import { supabase } from '@/lib/supabase';
import type { RsvpStatus } from '@/types/database';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, TextInput } from 'react-native';

function fullAddress(e: EventByInvite): string {
  const parts = [e.address_line1, e.address_line2, e.city, e.state, e.postal_code, e.country].filter(Boolean);
  return parts.join(', ');
}

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'late', label: 'Running late' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'cant', label: "Can't make it" },
];

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = (useLocalSearchParams<{ token?: string }>().token as string) ?? '';
  const action = (useLocalSearchParams<{ action?: string }>().action as string) ?? '';
  const contactParam = (useLocalSearchParams<{ email?: string; phone?: string }>().email as string) ?? (useLocalSearchParams<{ email?: string; phone?: string }>().phone as string) ?? '';
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>('going');
  const [wantsReminders, setWantsReminders] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const oneTapDone = useRef(false);

  const event = preview?.event ?? null;
  const capacity = (event as EventByInvite & { capacity?: number | null })?.capacity;
  const guestCount = preview?.guest_count ?? 0;
  const isEventFull = capacity != null && guestCount >= capacity;

  useEffect(() => {
    if (!id || !token) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }
    getInvitePreview(id, token).then((p) => {
      setPreview(p ?? null);
      setError(p ? null : 'Invite invalid or expired');
      setLoading(false);
    });
  }, [id, token]);

  useEffect(() => {
    if (contactParam) setGuestContact(contactParam);
    if (action === 'rsvp_going') setRsvpStatus('going');
    else if (action === 'rsvp_late') setRsvpStatus('late');
    else if (action === 'rsvp_cant') setRsvpStatus('cant');
  }, [action, contactParam]);

  useEffect(() => {
    if (oneTapDone.current || !preview?.event || !id || !token || !action || !contactParam.trim()) return;
    const status: RsvpStatus | null = action === 'rsvp_going' ? 'going' : action === 'rsvp_late' ? 'late' : action === 'rsvp_cant' ? 'cant' : null;
    if (!status) return;
    oneTapDone.current = true;
    hapticRsvp();
    setSubmitting(true);
    addGuestByInvite(id, token, 'Guest', contactParam.trim(), status, true).then((gid) => {
      setGuestId(gid ?? null);
      setSubmitting(false);
      if (gid) {
        notifyHostRsvpChange(id, 'Guest').catch(() => {});
        router.replace(`/event/${id}?guestId=${gid}`);
      }
    });
  }, [preview?.event, id, token, action, contactParam, router]);

  const handleRsvp = async () => {
    if (!event || !guestName.trim() || !guestContact.trim()) return;
    hapticRsvp();
    setSubmitting(true);
    const gid = await addGuestByInvite(id!, token, guestName.trim(), guestContact.trim(), rsvpStatus, wantsReminders);
    setGuestId(gid ?? null);
    setSubmitting(false);
    if (gid) {
      notifyHostRsvpChange(id!, guestName.trim()).catch(() => {});
      router.push(`/event/${id}?guestId=${gid}`);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    const url = `https://dinnerbell.app/invite/${id}?token=${token}`;
    await Share.share({ message: `You're invited to ${event.title}. RSVP: ${url}`, url });
  };

  const handleJoinWaitlist = async () => {
    if (!id || !event || !guestName.trim() || !guestContact.trim()) return;
    setWaitlistSubmitting(true);
    const contactType = guestContact.includes('@') ? 'email' : 'phone';
    const { error } = await supabase.from('event_waitlist').insert({
      event_id: id,
      contact_type: contactType,
      contact_value: guestContact.trim(),
      display_name: guestName.trim() || null,
    });
    setWaitlistSubmitting(false);
    if (!error) setWaitlistJoined(true);
  };

  if (loading) return <Text style={styles.centered}>Loading...</Text>;
  if (error || !event) return <Text style={styles.centered}>{error ?? 'Invite invalid or expired'}</Text>;

  const menuSectionsList = (preview?.menu_sections ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((sec) => ({
      title: sec.title,
      items: (preview?.menu_items ?? []).filter((mi) => mi.section_id === sec.id).sort((a, b) => a.sort_order - b.sort_order),
    }));

  const bringHighlights = (preview?.bring_items ?? []).slice(0, 4).map((b) => b.name).join(', ');
  const oneTapRsvp = async (status: RsvpStatus) => {
    const name = guestName.trim() || 'Guest';
    const contact = guestContact.trim() || contactParam;
    if (!contact || !event) return;
    hapticRsvp();
    setSubmitting(true);
    const gid = await addGuestByInvite(id!, token, name, contact, status, wantsReminders);
    setGuestId(gid ?? null);
    setSubmitting(false);
    if (gid) {
      notifyHostRsvpChange(id!, name).catch(() => {});
      router.push(`/event/${id}?guestId=${gid}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.richCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.title}>{event.title}</Text>
        {preview?.host_name ? <Text style={styles.hostBy}>Hosted by {preview.host_name}</Text> : null}
        <Text style={styles.date}>{new Date(event.start_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
        <Text style={styles.body}>{fullAddress(event)}</Text>
        {event.location_notes ? <Text style={styles.notes}>{event.location_notes}</Text> : null}
        {(preview?.bring_items?.length ?? 0) > 0 && (
          <Text style={styles.bringHighlights}>Bring: {bringHighlights || (preview!.bring_items.length > 1 ? `${preview!.bring_items.length} items` : preview!.bring_items[0].name)}</Text>
        )}
      </View>

      {menuSectionsList.length > 0 && (
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Menu</Text>
          {menuSectionsList.map((sec, idx) => (
            <View key={idx}>
              <Text style={styles.subsectionTitle}>{sec.title}</Text>
              {sec.items.map((item) => (
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
      {(preview?.bring_items?.length ?? 0) > 0 && (
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Bring list</Text>
          {preview!.bring_items.map((item) => (
            <Text key={item.id} style={styles.body}>• {item.name} ({item.quantity})</Text>
          ))}
        </View>
      )}

      {!guestId ? (
        <>
          {isEventFull ? (
            <>
              <Text style={[styles.eventFull, { color: colors.text }]}>This event is full</Text>
              {waitlistJoined ? (
                <Text style={styles.waitlistDone}>You're on the waitlist. We'll notify you if a spot opens up.</Text>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Join the waitlist</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.inputBorder }]}
                    value={guestName}
                    onChangeText={setGuestName}
                    placeholder="Your name"
                    placeholderTextColor="#888"
                  />
                  <TextInput
                    style={[styles.input, { borderColor: colors.inputBorder }]}
                    value={guestContact}
                    onChangeText={setGuestContact}
                    placeholder="Phone or email"
                    placeholderTextColor="#888"
                  />
                  <Pressable
                    style={[styles.button, { backgroundColor: colors.primaryButton }, waitlistSubmitting && styles.buttonDisabled]}
                    onPress={handleJoinWaitlist}
                    disabled={waitlistSubmitting}
                  >
                    <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{waitlistSubmitting ? 'Joining...' : Copy.invite.joinWaitlist}</Text>
                  </Pressable>
                </>
              )}
            </>
          ) : (
            <>
          <Text style={styles.sectionTitle}>RSVP</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.inputBorder }]}
            value={guestName}
            onChangeText={setGuestName}
            placeholder="Your name"
            placeholderTextColor="#888"
          />
          <TextInput
            style={[styles.input, { borderColor: colors.inputBorder }]}
            value={guestContact}
            onChangeText={setGuestContact}
            placeholder="Phone or email"
            placeholderTextColor="#888"
          />
          <View style={styles.rsvpRow}>
            {RSVP_OPTIONS.map(({ value, label }) => (
              <Pressable
                key={value}
                style={[styles.rsvpBtn, rsvpStatus === value && { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton }]}
                onPress={() => {
                  hapticRsvp();
                  setRsvpStatus(value);
                }}
              >
                <Text style={[styles.rsvpBtnText, rsvpStatus === value && { color: colors.primaryButtonText }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {(rsvpStatus === 'going' || rsvpStatus === 'maybe' || rsvpStatus === 'late') && (
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Send me reminders</Text>
              <Switch value={wantsReminders} onValueChange={setWantsReminders} />
            </View>
          )}
          <Pressable
            style={[styles.button, { backgroundColor: colors.primaryButton }, submitting && styles.buttonDisabled]}
            onPress={handleRsvp}
            disabled={submitting}
          >
            <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{submitting ? 'Saving...' : 'Submit RSVP'}</Text>
          </Pressable>
            </>
          )}
        </>
      ) : (
        <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={() => router.push(`/event/${id}`)}>
          <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>View event</Text>
        </Pressable>
      )}

      <Pressable style={styles.buttonSecondary} onPress={handleShare}>
        <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Share link</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, textAlign: 'center', marginTop: 40 },
  richCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  hostBy: { fontSize: 14, opacity: 0.85, marginBottom: 8 },
  date: { fontSize: 16, marginBottom: 8 },
  body: { fontSize: 14, marginBottom: 4 },
  notes: { fontSize: 14, opacity: 0.8, marginTop: 4, marginBottom: 4 },
  bringHighlights: { fontSize: 13, opacity: 0.9, marginTop: 8 },
  previewSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  subsectionTitle: { fontSize: 16, fontWeight: '500', marginTop: 8, marginBottom: 4 },
  menuItemRow: { marginBottom: 6 },
  dietaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginLeft: 16 },
  dietaryChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  dietaryChipText: { fontSize: 12, fontWeight: '500' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggleLabel: { fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  rsvpRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  rsvpBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  rsvpBtnText: { fontWeight: '600' },
  eventFull: { fontSize: 18, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  waitlistDone: { fontSize: 14, opacity: 0.9, marginBottom: 16, textAlign: 'center' },
  button: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  buttonSecondary: { padding: 16, alignItems: 'center', marginTop: 8 },
  buttonSecondaryText: { fontWeight: '600' },
});

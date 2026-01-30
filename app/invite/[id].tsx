import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { addGuestByInvite, getInvitePreview, type EventByInvite, type InvitePreview } from '@/lib/invite';
import { notifyHostRsvpChange } from '@/lib/notifyHost';
import type { RsvpStatus } from '@/types/database';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Switch, TextInput } from 'react-native';

function fullAddress(e: EventByInvite): string {
  const parts = [e.address_line1, e.address_line2, e.city, e.state, e.postal_code, e.country].filter(Boolean);
  return parts.join(', ');
}

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = (useLocalSearchParams<{ token?: string }>().token as string) ?? '';
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

  const event = preview?.event ?? null;

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

  const handleRsvp = async () => {
    if (!event || !guestName.trim() || !guestContact.trim()) return;
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

  if (loading) return <Text style={styles.centered}>Loading...</Text>;
  if (error || !event) return <Text style={styles.centered}>{error ?? 'Invite invalid or expired'}</Text>;

  const menuSectionsList = (preview?.menu_sections ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((sec) => ({
      title: sec.title,
      items: (preview?.menu_items ?? []).filter((mi) => mi.section_id === sec.id).sort((a, b) => a.sort_order - b.sort_order),
    }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.date}>{new Date(event.start_time).toLocaleString()}</Text>
      <Text style={styles.body}>{fullAddress(event)}</Text>
      {event.location_notes ? <Text style={styles.notes}>{event.location_notes}</Text> : null}

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
            {(['going', 'maybe', 'cant'] as const).map((status) => (
              <Pressable
                key={status}
                style={[styles.rsvpBtn, rsvpStatus === status && { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton }]}
                onPress={() => setRsvpStatus(status)}
              >
                <Text style={[styles.rsvpBtnText, rsvpStatus === status && { color: colors.primaryButtonText }]}>
                  {status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : "Can't"}
                </Text>
              </Pressable>
            ))}
          </View>
          {(rsvpStatus === 'going' || rsvpStatus === 'maybe') && (
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
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  date: { fontSize: 16, marginBottom: 12 },
  body: { fontSize: 14, marginBottom: 4 },
  notes: { fontSize: 14, opacity: 0.8, marginTop: 4, marginBottom: 16 },
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
  button: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  buttonSecondary: { padding: 16, alignItems: 'center', marginTop: 8 },
  buttonSecondaryText: { fontWeight: '600' },
});

import { Avatar } from '@/components/Avatar';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { hapticSuccess } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import type { BringItemRow, EventGuest, EventWithDetails, MenuItemRow, MenuSection } from '@/types/events';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [bringItems, setBringItems] = useState<BringItemRow[]>([]);
  const [menuSections, setMenuSections] = useState<(MenuSection & { menu_items: MenuItemRow[] })[]>([]);
  const [hostName, setHostName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      if (eventError || !eventData) {
        setError('Event not found');
        setLoading(false);
        return;
      }
      setEvent(eventData as EventWithDetails);
      const { data: hostProfile } = await supabase.from('profiles').select('name').eq('id', (eventData as EventWithDetails).host_user_id).single();
      setHostName((hostProfile as { name?: string } | null)?.name ?? null);

      const [{ data: guestList }, { data: bring }, { data: sections }, { data: items }] = await Promise.all([
        supabase.from('event_guests').select('*').eq('event_id', id),
        supabase.from('bring_items').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('menu_sections').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('menu_items').select('*').eq('event_id', id).order('sort_order'),
      ]);

      setGuests(guestList ?? []);
      setBringItems(bring ?? []);
      const sectionMap = new Map<string, MenuSection & { menu_items: MenuItemRow[] }>();
      (sections ?? []).forEach((s: MenuSection) => sectionMap.set(s.id, { ...s, menu_items: [] }));
      (items ?? []).forEach((item: MenuItemRow) => {
        const sec = sectionMap.get(item.section_id);
        if (sec) sec.menu_items.push(item);
      });
      setMenuSections(Array.from(sectionMap.values()).sort((a, b) => a.sort_order - b.sort_order));
      setLoading(false);
    };
    load();
  }, [id]);

  const whoCame = guests.filter((g) => g.rsvp_status === 'going' || (g as EventGuest & { arrived_at?: string }).arrived_at);
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const whatWasBrought = bringItems.filter((b) => b.status === 'claimed' || b.status === 'provided');

  const handleDoThisAgain = () => {
    hapticSuccess();
    router.replace(`/create?duplicateEventId=${id}`);
  };

  if (loading) return <Text style={styles.centered}>Loading...</Text>;
  if (error || !event) return <Text style={styles.centered}>{error ?? 'Event not found'}</Text>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.thanks}>{Copy.recap.thanks}</Text>
      {hostName ? <Text style={styles.hostBy}>— {hostName}</Text> : null}
      <Text style={styles.title}>{event.title}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{Copy.recap.whoCame}</Text>
        <View style={styles.avatarRow}>
          {whoCame.map((g) => (
            <View key={g.id} style={styles.avatarWrap}>
              <Avatar initials={initials(g.guest_name)} size={44} />
              <Text style={styles.guestName}>{g.guest_name}</Text>
            </View>
          ))}
        </View>
      </View>

      {whatWasBrought.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What was brought</Text>
          {whatWasBrought.map((item) => {
            const guest = item.claimed_by_guest_id ? guestById.get(item.claimed_by_guest_id) : null;
            return (
              <View key={item.id} style={styles.broughtRow}>
                <Text style={styles.broughtName}>{item.name}</Text>
                {guest ? <Text style={styles.broughtBy}> — {guest.guest_name}</Text> : null}
              </View>
            );
          })}
        </View>
      )}

      <Pressable style={[styles.doAgainBtn, { backgroundColor: colors.primaryButton }]} onPress={handleDoThisAgain}>
        <Text style={[styles.doAgainText, { color: colors.primaryButtonText }]}>{Copy.recap.doThisAgain}</Text>
      </Pressable>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={[styles.backBtnText, { color: colors.tint }]}>{Copy.recap.backToEvent}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  accentBar: { height: 4, marginBottom: 12, borderRadius: 2 },
  centered: { flex: 1, textAlign: 'center', marginTop: 40 },
  thanks: { fontSize: 22, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  hostBy: { fontSize: 14, opacity: 0.85, marginBottom: 16, textAlign: 'center' },
  title: { fontSize: 18, opacity: 0.9, marginBottom: 24, textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  avatarWrap: { alignItems: 'center' },
  guestName: { fontSize: 12, marginTop: 4 },
  broughtRow: { flexDirection: 'row', marginBottom: 6 },
  broughtName: { fontWeight: '500' },
  broughtBy: { opacity: 0.85 },
  doAgainBtn: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  doAgainText: { fontSize: 18, fontWeight: '600' },
  backBtn: { padding: 16, alignItems: 'center', marginTop: 12 },
  backBtnText: { fontWeight: '600' },
});

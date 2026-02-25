import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Avatar } from '@/components/Avatar';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { GradientHeader } from '@/components/GradientHeader';
import { SkeletonCardList } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { fontWeight, letterSpacing, radius, spacing, typography } from '@/constants/Theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { trackScreenViewed } from '@/lib/analytics';
import { hapticSuccess } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import type { BringItemCategory } from '@/types/database';
import type { BringItemRow, EventGuest, EventWithDetails, MenuItemRow, MenuSection } from '@/types/events';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return '?';
}

function getCategoryColors(colors: typeof Colors['light']): Record<BringItemCategory, string> {
  return {
    drink: colors.categoryBlue,
    side: colors.categoryGreen,
    dessert: colors.categoryAmber,
    supplies: colors.categoryNeutral,
    other: colors.categoryMuted,
  };
}

export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const categoryColors = getCategoryColors(colors);
  const reduceMotion = useReducedMotion();
  const [event, setEvent] = useState<EventWithDetails | null>(null);
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [bringItems, setBringItems] = useState<BringItemRow[]>([]);
  const [menuSections, setMenuSections] = useState<(MenuSection & { menu_items: MenuItemRow[] })[]>([]);
  const [hostName, setHostName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(true);

  useEffect(() => {
    trackScreenViewed('EventRecap');
  }, []);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      if (eventError || !eventData) {
        setError(Copy.event.notFound);
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

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        message: `Had a great time at "${event.title}"! 🍽️ — shared from Dinner Bell`,
      });
    } catch {
      // user cancelled or share failed silently
    }
  };

  if (loading) {
    return (
      <View style={styles.skeletonWrap}>
        <SkeletonCardList count={2} />
      </View>
    );
  }
  if (error || !event) return <Text style={[styles.centered, { color: colors.textSecondary }]}>{error ?? Copy.event.notFound}</Text>;

  return (
    <View style={styles.outerWrap}>
      <CelebrationOverlay
        visible={showCelebration}
        headline="What a night!"
        onFinish={() => setShowCelebration(false)}
        displayDuration={2000}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <GradientHeader
          title={Copy.recap.thanks}
          subtitle={event.title}
          height={200}
          onBack={() => router.back()}
        />
        {hostName ? <Text style={styles.hostBy}>— {hostName}</Text> : null}
        <Text style={[styles.snapshotText, { color: colors.textSecondary }]}>
          {Copy.recap.snapshot(whoCame.length, whatWasBrought.length)}
        </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{Copy.recap.whoCame}</Text>
        <View style={styles.avatarGrid}>
          {whoCame.map((g, index) => (
            <Animated.View
              key={g.id}
              entering={reduceMotion ? undefined : FadeInDown.delay(index * 80).springify()}
              style={styles.avatarWrap}
            >
              <Avatar initials={initials(g.guest_name)} size={52} />
              <Text style={styles.guestName} numberOfLines={1}>{g.guest_name}</Text>
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{Copy.recap.whatWasBrought}</Text>
        {whatWasBrought.length > 0 ? (
          whatWasBrought.map((item, index) => {
            const guest = item.claimed_by_guest_id ? guestById.get(item.claimed_by_guest_id) : null;
            const borderColor = categoryColors[item.category] ?? categoryColors.other;
            return (
              <Animated.View
                key={item.id}
                entering={reduceMotion ? undefined : FadeInDown.delay(index * 60).springify()}
                style={[
                  styles.broughtCard,
                  { backgroundColor: colors.elevatedSurface, borderLeftColor: borderColor },
                ]}
              >
                <View style={styles.broughtCardInner}>
                  <Text style={[styles.broughtName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.broughtCategory, { color: borderColor }]}>
                    {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                  </Text>
                </View>
                {guest ? (
                  <Text style={[styles.broughtBy, { color: colors.textSecondary }]}>
                    Brought by {guest.guest_name}
                  </Text>
                ) : null}
              </Animated.View>
            );
          })
        ) : (
          <Text style={[styles.emptyBringText, { color: colors.textSecondary }]}>{Copy.recap.noBringItems}</Text>
        )}
      </View>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Share this memory"
        style={[styles.shareBtn, { borderColor: colors.tint }]}
        onPress={handleShare}
      >
        <Text style={[styles.shareBtnText, { color: colors.tint }]}>Share this memory</Text>
      </AnimatedPressable>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Host this event again"
        style={[styles.doAgainBtn, { backgroundColor: colors.primaryButton }]}
        onPress={handleDoThisAgain}
      >
        <Text style={[styles.doAgainText, { color: colors.primaryButtonText }]}>{Copy.recap.doThisAgain}</Text>
      </AnimatedPressable>

      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Back to event"
        style={styles.backBtn}
        onPress={() => router.back()}
      >
        <Text style={[styles.backBtnText, { color: colors.tint }]}>{Copy.recap.backToEvent}</Text>
      </AnimatedPressable>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: { flex: 1 },
  container: { flex: 1 },
  content: { paddingBottom: spacing.xxl + spacing.lg },
  skeletonWrap: { flex: 1, padding: spacing.xl, paddingTop: spacing.xxl },
  centered: { flex: 1, textAlign: 'center', marginTop: spacing.xxl },
  hostBy: {
    fontSize: typography.meta,
    fontWeight: fontWeight.medium,
    opacity: 0.85,
    marginBottom: spacing.lg,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  snapshotText: {
    fontSize: typography.meta,
    textAlign: 'center',
    marginBottom: spacing.lg,
    opacity: 0.9,
  },
  section: { marginBottom: spacing.xl, paddingHorizontal: spacing.xl },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
    letterSpacing: letterSpacing.title,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  avatarWrap: {
    alignItems: 'center',
    width: 72,
  },
  guestName: {
    fontSize: typography.microLabel,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  broughtCard: {
    borderLeftWidth: 4,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  broughtCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  broughtName: {
    fontWeight: fontWeight.semibold,
    fontSize: typography.body,
    flexShrink: 1,
  },
  broughtCategory: {
    fontSize: typography.microLabel,
    fontWeight: fontWeight.medium,
    textTransform: 'capitalize',
  },
  broughtBy: {
    fontSize: typography.meta,
    marginTop: spacing.xs,
  },
  emptyBringText: { fontSize: typography.meta, opacity: 0.7 },
  shareBtn: {
    padding: spacing.lg,
    borderRadius: radius.button,
    alignItems: 'center',
    marginTop: spacing.xl,
    marginHorizontal: spacing.xl,
    borderWidth: 2,
  },
  shareBtnText: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
  doAgainBtn: {
    padding: spacing.lg + 2,
    borderRadius: radius.button,
    alignItems: 'center',
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
  },
  doAgainText: {
    fontSize: typography.h3,
    fontWeight: fontWeight.semibold,
  },
  backBtn: {
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    marginHorizontal: spacing.xl,
  },
  backBtnText: {
    fontWeight: fontWeight.semibold,
  },
});

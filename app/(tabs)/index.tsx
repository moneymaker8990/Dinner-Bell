import { AppShell } from '@/components/AppShell';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, CardBody } from '@/components/Card';
import { DinnerTriangleIcon } from '@/components/DinnerTriangleIcon';
import { EmptyState } from '@/components/EmptyState';
import { EventCard, formatCountdown } from '@/components/EventCard';
import { Section } from '@/components/Section';
import { SkeletonCardList } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { EventWithDetails } from '@/types/events';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, RefreshControl, ScrollView, StyleSheet } from 'react-native';

function shortLocation(e: EventWithDetails): string | null {
  if (e.location_name) return e.location_name;
  if (e.city) return e.city;
  if (e.address_line1) return e.address_line1;
  return null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, isSignedIn } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [nextEvent, setNextEvent] = useState<EventWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.96)).current;

  const fetchNextEvent = useCallback(async () => {
    if (!user) {
      setNextEvent(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const now = new Date().toISOString();
    const { data: hostEvents } = await supabase
      .from('events')
      .select('*')
      .eq('host_user_id', user.id)
      .eq('is_cancelled', false)
      .gte('bell_time', now)
      .order('bell_time', { ascending: true })
      .limit(1);
    if (hostEvents?.[0]) {
      setNextEvent(hostEvents[0] as EventWithDetails);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { data: guestRows } = await supabase
      .from('event_guests')
      .select('event_id')
      .eq('user_id', user.id)
      .in('rsvp_status', ['going', 'maybe']);
    if (!guestRows?.length) {
      setNextEvent(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const eventIds = (guestRows as { event_id: string }[]).map((r) => r.event_id);
    const { data: guestEvents } = await supabase
      .from('events')
      .select('*')
      .in('id', eventIds)
      .eq('is_cancelled', false)
      .gte('bell_time', now)
      .order('bell_time', { ascending: true })
      .limit(1);
    setNextEvent(guestEvents?.[0] ? (guestEvents[0] as EventWithDetails) : null);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setNextEvent(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchNextEvent();
  }, [user?.id, fetchNextEvent]);

  const onRefresh = useCallback(() => {
    if (!isSignedIn) return;
    setRefreshing(true);
    fetchNextEvent();
  }, [isSignedIn, fetchNextEvent]);

  const useNativeDriver = Platform.OS !== 'web';
  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 360,
        useNativeDriver,
      }),
      Animated.timing(heroScale, {
        toValue: 1,
        duration: 360,
        useNativeDriver,
      }),
    ]).start();
  }, [heroOpacity, heroScale, useNativeDriver]);

  return (
    <AppShell>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isSignedIn ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
          ) : undefined
        }>
        {/* Hero */}
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: heroOpacity,
              transform: [{ scale: heroScale }],
            },
          ]}>
          <DinnerTriangleIcon size={64} />
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Dinner Bell</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Ring the bell and gather your people.
          </Text>
        </Animated.View>

        {/* CTA */}
        <Link href="/create" asChild>
          <PrimaryButton style={styles.createBtn}>Create Dinner</PrimaryButton>
        </Link>

        {/* Content */}
        {loading ? (
          <Section title="Next Up">
            <SkeletonCardList count={1} />
          </Section>
        ) : !isSignedIn ? (
          <Card style={styles.signInCard}>
            <CardBody>
              <Text style={[styles.signInText, { color: colors.textSecondary }]}>
                Sign in to create events, RSVP, and get notified when it's time.
              </Text>
              <SecondaryButton onPress={() => router.push('/sign-in')}>Sign in</SecondaryButton>
            </CardBody>
          </Card>
        ) : nextEvent ? (
          <Section title="Next Up">
            {(() => {
              const { text, within24h } = formatCountdown(nextEvent.bell_time);
              const countdownLabel =
                text === 'Past' ? '' : within24h ? `In ${text}` : `${text} until bell`;
              const dateTime = new Date(nextEvent.bell_time).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              });
              return countdownLabel ? (
                <View style={styles.countdownRow}>
                  <Text style={[styles.countdownText, { color: colors.tint }]}>{countdownLabel}</Text>
                  <Text style={[styles.countdownDateTime, { color: colors.textSecondary }]}>
                    {dateTime}
                  </Text>
                </View>
              ) : null;
            })()}
            <EventCard
              eventId={nextEvent.id}
              title={nextEvent.title}
              bellTime={nextEvent.bell_time}
              isHost={nextEvent.host_user_id === user?.id}
              location={shortLocation(nextEvent)}
              addressLine1={nextEvent.address_line1}
              city={nextEvent.city}
              featured
            />
          </Section>
        ) : (
          <EmptyState
            headline="No dinners on the books yet."
            body="Create a dinner, invite your people, and ring the bell when it's time."
            primaryCta={
              <Link href="/create" asChild>
                <PrimaryButton>Create your first Dinner Bell</PrimaryButton>
              </Link>
            }
          />
        )}

        {/* Quick links */}
        {isSignedIn && (
          <View style={styles.quickLinks}>
            <SecondaryButton onPress={() => router.push('/(tabs)/events')}>
              View all events
            </SecondaryButton>
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl * 2 },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  countdownText: {
    fontSize: typography.h3,
    fontWeight: '700',
  },
  countdownDateTime: {
    fontSize: typography.caption,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  heroTitle: {
    fontSize: typography.h1,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  heroSubtitle: {
    fontSize: typography.body,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  createBtn: {
    marginBottom: spacing.xxl,
  },
  signInCard: {
    marginBottom: spacing.xl,
  },
  signInText: {
    fontSize: typography.body,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  quickLinks: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
});

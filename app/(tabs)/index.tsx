import { AnimatedCountdown } from '@/components/AnimatedCountdown';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { AppShell } from '@/components/AppShell';
import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, CardBody } from '@/components/Card';
import { BrandLogo } from '@/components/BrandLogo';
import { EmptyState } from '@/components/EmptyState';
import { EventCard, formatCountdown } from '@/components/EventCard';
import { GradientHeader } from '@/components/GradientHeader';
import { Section } from '@/components/Section';
import { SkeletonCardList } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { elevation, fontWeight, lineHeight, radius, spacing, typography } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { trackScreenViewed } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { EventWithDetails } from '@/types/events';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet
} from 'react-native';
import ReAnimated, {
    Easing,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

function shortLocation(e: EventWithDetails): string | null {
  if (e.location_name) return e.location_name;
  if (e.city) return e.city;
  if (e.address_line1) return e.address_line1;
  return null;
}

const CREATE_HINT_KEY = 'has_seen_create_hint_v1';

export default function HomeScreen() {
  const router = useRouter();
  const { user, isSignedIn } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion();
  const [nextEvent, setNextEvent] = useState<EventWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateHint, setShowCreateHint] = useState(false);

  // FAB spring animation
  const fabScale = useSharedValue(0);
  // Pulsing for urgent countdown
  const pulseScale = useSharedValue(1);

  const fetchNextEvent = useCallback(async () => {
    if (!user) {
      setNextEvent(null);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }
    setError(null);
    try {
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
        return;
      }
      const { data: guestRows } = await supabase
        .from('event_guests')
        .select('event_id')
        .eq('user_id', user.id)
        .in('rsvp_status', ['going', 'maybe']);
      if (!guestRows?.length) {
        setNextEvent(null);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  useEffect(() => {
    if (!isSignedIn) return;
    AsyncStorage.getItem(CREATE_HINT_KEY).then((value) => {
      if (!value) setShowCreateHint(true);
    });
  }, [isSignedIn]);

  const dismissCreateHint = useCallback(() => {
    setShowCreateHint(false);
    AsyncStorage.setItem(CREATE_HINT_KEY, 'true');
  }, []);

  // FAB entrance spring
  useEffect(() => {
    if (isSignedIn && !reduceMotion) {
      fabScale.value = withDelay(400, withSpring(1, { damping: 12, stiffness: 180 }));
    } else if (isSignedIn) {
      fabScale.value = 1;
    }
  }, [isSignedIn, reduceMotion, fabScale]);

  // Pulsing countdown when event is < 1 hour away
  useEffect(() => {
    if (nextEvent && !reduceMotion) {
      const bellTime = new Date(nextEvent.bell_time).getTime();
      const now = Date.now();
      const hoursAway = (bellTime - now) / (1000 * 60 * 60);
      if (hoursAway > 0 && hoursAway < 1) {
        pulseScale.value = withRepeat(
          withTiming(1.06, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
        );
      } else {
        pulseScale.value = 1;
      }
    } else {
      pulseScale.value = 1;
    }
  }, [nextEvent, reduceMotion, pulseScale]);

  const onRefresh = useCallback(() => {
    if (!isSignedIn) return;
    setRefreshing(true);
    fetchNextEvent();
  }, [isSignedIn, fetchNextEvent]);

  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

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
        }
      >
        {/* Branded gradient hero — extra top padding so the bell icon is not cut off */}
        <GradientHeader height={260}>
          <View style={[styles.heroInner, styles.heroInnerTopPadding]}>
            <View style={styles.heroIconGlow}>
              <BrandLogo size={72} variant="default" />
            </View>
            <ReAnimated.Text
              style={[styles.heroTitle, { color: colors.onGradient }]}
              accessibilityRole="header"
            >
              {Copy.home.heroTitle}
            </ReAnimated.Text>
            <ReAnimated.Text style={[styles.heroSubtitle, { color: colors.onGradientMuted }]}>
              {Copy.home.heroSubtitle}
            </ReAnimated.Text>
          </View>
        </GradientHeader>

        <View style={styles.contentArea}>
          {/* CTA */}
          <Link href="/create" asChild>
            <PrimaryButton style={styles.createBtn}>Create Dinner</PrimaryButton>
          </Link>
          {isSignedIn && !loading && !nextEvent && showCreateHint ? (
            <View style={[styles.createHint, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.createHintText, { color: colors.textSecondary }]}>
                Start with one dinner, invite your people, then ring the bell when it is ready.
              </Text>
              <SecondaryButton onPress={dismissCreateHint}>Got it</SecondaryButton>
            </View>
          ) : null}

          {/* Content */}
          {loading ? (
            <Section title={Copy.home.nextUp}>
              <SkeletonCardList count={1} />
            </Section>
          ) : error ? (
            <Section title={Copy.home.nextUp}>
              <Text style={[styles.errorTitle, { color: colors.textPrimary }]} accessibilityRole="header">{error}</Text>
              <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
                Pull down to refresh and try again.
              </Text>
            </Section>
          ) : !isSignedIn ? (
            <Card style={styles.signInCard}>
              <CardBody>
                <Text style={[styles.signInText, { color: colors.textSecondary }]}>
                  {Copy.home.signInPrompt}
                </Text>
                <SecondaryButton onPress={() => router.push('/sign-in')}>Sign in</SecondaryButton>
              </CardBody>
            </Card>
          ) : nextEvent ? (
            <Section title={Copy.home.nextUp}>
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

                // Check if < 1h for urgency
                const bellTime = new Date(nextEvent.bell_time).getTime();
                const hoursAway = (bellTime - Date.now()) / (1000 * 60 * 60);
                const isUrgent = hoursAway > 0 && hoursAway < 1;

                return (
                  <View style={styles.countdownRow}>
                    <AnimatedCountdown bellTime={nextEvent.bell_time} compact />
                    <Text style={[styles.countdownDateTime, { color: colors.textSecondary }]}>
                      {dateTime}
                    </Text>
                  </View>
                );
              })()}

              {/* Frosted glass next-event card */}
              <AnimatedPressable
                onPress={() => router.push(`/event/${nextEvent.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`View event: ${nextEvent.title}`}
              >
                <View style={[styles.frostedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                </View>
              </AnimatedPressable>
            </Section>
          ) : (
            <ReAnimated.View
              entering={reduceMotion ? undefined : FadeInDown.delay(200).duration(400)}
            >
              <EmptyState
                headline={Copy.home.emptyHeadline}
                body={Copy.home.emptyBody}
                primaryCta={
                  <Link href="/create" asChild>
                    <PrimaryButton>{Copy.home.emptyCta}</PrimaryButton>
                  </Link>
                }
              />
            </ReAnimated.View>
          )}

          {/* Quick links */}
          {isSignedIn && (
            <View style={styles.quickLinks}>
              <SecondaryButton onPress={() => router.push('/(tabs)/events')}>
                {Copy.common.viewAllEvents}
              </SecondaryButton>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Animated FAB */}
      {isSignedIn && (
        <ReAnimated.View style={[styles.fabContainer, fabAnimStyle]}>
          <AnimatedPressable
            style={[
              styles.fab,
              {
                backgroundColor: colors.primaryBrand,
                shadowColor: colors.shadow,
              },
            ]}
            onPress={() => router.push('/create')}
            accessibilityLabel="Create dinner"
            accessibilityRole="button"
            pressScale={0.9}
          >
            <FontAwesome name="plus" size={24} color={colors.primaryButtonText} />
          </AnimatedPressable>
        </ReAnimated.View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl * 2 },
  heroInner: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'transparent',
    paddingTop: spacing.sm,
  },
  heroInnerTopPadding: {
    paddingTop: spacing.xl,
  },
  heroIconGlow: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.chip,
    padding: spacing.md,
  },
  heroTitle: {
    fontSize: typography.h1,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
  },
  heroSubtitle: {
    fontSize: typography.body,
    textAlign: 'center',
  },
  contentArea: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    backgroundColor: 'transparent',
  },
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
    fontWeight: fontWeight.bold,
  },
  countdownDateTime: {
    fontSize: typography.caption,
  },
  createBtn: {
    marginBottom: spacing.xxl,
  },
  createHint: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  createHintText: {
    fontSize: typography.meta,
    lineHeight: lineHeight.meta,
  },
  signInCard: {
    marginBottom: spacing.xl,
  },
  signInText: {
    fontSize: typography.body,
    marginBottom: spacing.lg,
    lineHeight: lineHeight.body,
  },
  frostedCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quickLinks: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
  errorBody: {
    fontSize: typography.meta,
    marginTop: spacing.xs,
  },
  fabContainer: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl + 64,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: radius.fab,
    justifyContent: 'center',
    alignItems: 'center',
    ...elevation.floating,
  },
});

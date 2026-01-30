import { AppShell } from '@/components/AppShell';
import { GhostButton, PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { EmptyState } from '@/components/EmptyState';
import { EventCard } from '@/components/EventCard';
import { PageHeader } from '@/components/PageHeader';
import { Section } from '@/components/Section';
import { SkeletonCardList } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { createDemoEvent } from '@/lib/demoEvent';
import { supabase } from '@/lib/supabase';
import type { EventWithDetails } from '@/types/events';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

function shortLocation(e: EventWithDetails): string | null {
  if (e.location_name) return e.location_name;
  if (e.city) return e.city;
  if (e.address_line1) return e.address_line1;
  return null;
}

export default function EventsScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const [upcomingEvents, setUpcomingEvents] = useState<EventWithDetails[]>([]);
  const [pastEvents, setPastEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pastCollapsed, setPastCollapsed] = useState(true);
  const [demoEvent, setDemoEvent] = useState<EventWithDetails | null>(null);
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setUpcomingEvents([]);
      setPastEvents([]);
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
      .order('bell_time', { ascending: true });
    const hostIds = (hostEvents ?? []) as { id: string }[];
    const hostIdList = hostIds.map((e) => e.id);

    const { data: guestRows } = await supabase
      .from('event_guests')
      .select('event_id')
      .eq('user_id', user.id)
      .in('rsvp_status', ['going', 'maybe']);
    const guestEventIds = ((guestRows ?? []) as { event_id: string }[])
      .map((r) => r.event_id)
      .filter((eid) => !hostIdList.includes(eid));

    let guestEvents: EventWithDetails[] = [];
    if (guestEventIds.length > 0) {
      const { data } = await supabase
        .from('events')
        .select('*')
        .in('id', guestEventIds)
        .eq('is_cancelled', false)
        .gte('bell_time', now)
        .order('bell_time', { ascending: true });
      guestEvents = (data ?? []) as EventWithDetails[];
    }

    const combined = [...((hostEvents ?? []) as EventWithDetails[]), ...guestEvents].sort(
      (a, b) => new Date(a.bell_time).getTime() - new Date(b.bell_time).getTime()
    );
    setUpcomingEvents(combined);

    const { data: pastHost } = await supabase
      .from('events')
      .select('*')
      .eq('host_user_id', user.id)
      .lt('bell_time', now)
      .order('bell_time', { ascending: false })
      .limit(10);
    setPastEvents((pastHost ?? []) as EventWithDetails[]);

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUpcomingEvents([]);
      setPastEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchEvents();
  }, [user, fetchEvents]);

  const onRefresh = useCallback(() => {
    if (!user) return;
    setRefreshing(true);
    fetchEvents();
  }, [user, fetchEvents]);

  const handleCreateDemo = useCallback(() => {
    const demo = createDemoEvent();
    setDemoEvent(demo);
    toast.show('Demo event created! This is a local preview.');
  }, [toast]);

  const nextUp = upcomingEvents[0] ?? null;
  const upcoming = upcomingEvents.slice(1);
  const allEmpty = upcomingEvents.length === 0 && !demoEvent;

  return (
    <AppShell>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          user ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />
          ) : undefined
        }>
        <PageHeader
          title="Events"
          subtitle="Your upcoming dinners, hangs, and little feasts."
          actions={
            <View style={styles.headerActions}>
              <Link href="/create" asChild>
                <PrimaryButton>Create Dinner</PrimaryButton>
              </Link>
            </View>
          }
        />

        {loading ? (
          <SkeletonCardList count={3} />
        ) : allEmpty ? (
          <EmptyState
            variant="events"
            headline="No upcoming dinners"
            body="Create a dinner, invite your people, or see a demo to get started."
            primaryCta={
              <Link href="/create" asChild>
                <PrimaryButton>Create Dinner</PrimaryButton>
              </Link>
            }
            secondaryCta={
              <SecondaryButton onPress={handleCreateDemo}>See a demo event</SecondaryButton>
            }
          />
        ) : (
          <>
            {/* Demo event preview */}
            {demoEvent && upcomingEvents.length === 0 && (
              <Section
                title="Demo Preview"
                action={
                  <GhostButton onPress={() => setDemoEvent(null)} textStyle={{ fontSize: typography.small }}>
                    Dismiss
                  </GhostButton>
                }
              >
                <EventCard
                  eventId={demoEvent.id}
                  title={demoEvent.title}
                  bellTime={demoEvent.bell_time}
                  isHost
                  location={shortLocation(demoEvent)}
                  addressLine1={demoEvent.address_line1}
                  city={demoEvent.city}
                  goingCount={5}
                  maybeCount={2}
                  unclaimedBringCount={3}
                  featured
                />
              </Section>
            )}

            {/* Next Up */}
            {nextUp && (
              <Section title="Next Up">
                <EventCard
                  eventId={nextUp.id}
                  title={nextUp.title}
                  bellTime={nextUp.bell_time}
                  isHost={nextUp.host_user_id === user?.id}
                  location={shortLocation(nextUp)}
                  addressLine1={nextUp.address_line1}
                  city={nextUp.city}
                  featured
                />
              </Section>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <Section title="Upcoming">
                {upcoming.map((e) => (
                  <EventCard
                    key={e.id}
                    eventId={e.id}
                    title={e.title}
                    bellTime={e.bell_time}
                    isHost={e.host_user_id === user?.id}
                    location={shortLocation(e)}
                    addressLine1={e.address_line1}
                    city={e.city}
                  />
                ))}
              </Section>
            )}

            {/* Past */}
            <Section
              title="Past"
              collapsible
              collapsed={pastCollapsed}
              onToggle={() => setPastCollapsed(!pastCollapsed)}
            >
              {pastEvents.length === 0 ? (
                <View style={styles.emptySection}>
                  <FontAwesome name="clock-o" size={24} color={colors.textSecondary + '60'} />
                  <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                    No past events yet. Your dinner memories will live here.
                  </Text>
                </View>
              ) : (
                pastEvents.map((e) => (
                  <EventCard
                    key={e.id}
                    eventId={e.id}
                    title={e.title}
                    bellTime={e.bell_time}
                    isHost={e.host_user_id === user?.id}
                    location={shortLocation(e)}
                    addressLine1={e.address_line1}
                    city={e.city}
                  />
                ))
              )}
            </Section>

            {/* Drafts */}
            <Section title="Drafts">
              <View style={styles.emptySection}>
                <FontAwesome name="file-text-o" size={24} color={colors.textSecondary + '60'} />
                <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
                  Drafts are coming soon. Save events before you're ready to send.
                </Text>
              </View>
            </Section>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl * 2 },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  emptySectionText: {
    fontSize: typography.caption,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
});

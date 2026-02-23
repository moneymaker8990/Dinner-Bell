import { AnimatedPressable } from '@/components/AnimatedPressable';
import { AppShell } from '@/components/AppShell';
import { PrimaryButton } from '@/components/Buttons';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { EventCard } from '@/components/EventCard';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonCardList } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { lineHeight, radius, spacing, typography } from '@/constants/Theme';
import { supabase } from '@/lib/supabase';
import type { EventWithDetails } from '@/types/events';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

type DiscoverEvent = Pick<
  EventWithDetails,
  'id' | 'title' | 'bell_time' | 'host_user_id' | 'address_line1' | 'city' | 'location_name'
> & {
  invite_token: string;
  is_public: boolean;
  is_cancelled: boolean;
};

function shortLocation(e: DiscoverEvent): string | null {
  if (e.location_name) return e.location_name;
  if (e.city) return e.city;
  if (e.address_line1) return e.address_line1;
  return null;
}

export default function DiscoverScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [events, setEvents] = useState<DiscoverEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    setError(null);
    try {
      const now = new Date().toISOString();
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('id, title, bell_time, host_user_id, address_line1, city, location_name, invite_token, is_public, is_cancelled')
        .eq('is_public', true)
        .eq('is_cancelled', false)
        .gte('bell_time', now)
        .order('bell_time', { ascending: true })
        .limit(30);
      if (fetchError) throw fetchError;
      setEvents((data ?? []) as DiscoverEvent[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : Copy.validation.genericError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  return (
    <AppShell>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.tint} />}
      >
        <PageHeader title={Copy.discover.title} subtitle={Copy.discover.subtitle} />

        {loading ? (
          <SkeletonCardList count={2} />
        ) : error ? (
          <Card style={styles.errorCard}>
            <CardBody>
              <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>{Copy.discover.errorTitle}</Text>
              <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{error}</Text>
              <PrimaryButton style={styles.retryBtn} onPress={loadEvents}>
                {Copy.offline.retry}
              </PrimaryButton>
            </CardBody>
          </Card>
        ) : events.length === 0 ? (
          <EmptyState
            headline={Copy.discover.emptyHeadline}
            body={Copy.discover.emptyBody}
            primaryCta={
              <PrimaryButton onPress={handleRefresh}>{Copy.offline.retry}</PrimaryButton>
            }
          />
        ) : (
          <View style={styles.list}>
            {events.map((event) => (
              <AnimatedPressable
                key={event.id}
                pressScale={0.98}
                accessibilityRole="button"
                accessibilityLabel={`${Copy.discover.openInvite}: ${event.title}`}
                onPress={() => router.push(`/invite/${event.id}?token=${event.invite_token}`)}
              >
                <View style={[styles.cardWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <EventCard
                    eventId={event.id}
                    title={event.title}
                    bellTime={event.bell_time}
                    isHost={false}
                    location={shortLocation(event)}
                    addressLine1={event.address_line1}
                    city={event.city}
                  />
                  <Text style={[styles.openInviteLabel, { color: colors.tint }]}>{Copy.discover.openInvite}</Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  list: {
    gap: spacing.md,
  },
  cardWrap: {
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  openInviteLabel: {
    fontSize: typography.meta,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    fontWeight: '600',
  },
  errorCard: {
    marginTop: spacing.sm,
  },
  errorTitle: {
    fontSize: typography.headline,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  errorBody: {
    fontSize: typography.body,
    lineHeight: lineHeight.body,
  },
  retryBtn: {
    marginTop: spacing.md,
  },
});

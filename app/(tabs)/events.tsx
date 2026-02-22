import { AnimatedPressable } from '@/components/AnimatedPressable';
import { AppShell } from '@/components/AppShell';
import { GhostButton, PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, CardBody } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { EventCard } from '@/components/EventCard';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonCardList } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { fontWeight, lineHeight, radius, spacing, typography } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useEvents } from '@/hooks/useEvents';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { createDemoEvent } from '@/lib/demoEvent';
import type { EventWithDetails } from '@/types/events';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

function shortLocation(e: EventWithDetails): string | null {
  if (e.location_name) return e.location_name;
  if (e.city) return e.city;
  if (e.address_line1) return e.address_line1;
  return null;
}

type SectionData = {
  title: string;
  badge?: number;
  data: EventWithDetails[];
  isDemoSection?: boolean;
};

type SectionEventItemProps = {
  item: EventWithDetails;
  index: number;
  sectionTitle: string;
  isDemoSection?: boolean;
  reduceMotion: boolean;
  userId: string | undefined;
};

const SectionEventItem = React.memo(function SectionEventItem({
  item,
  index,
  sectionTitle,
  isDemoSection,
  reduceMotion,
  userId,
}: SectionEventItemProps) {
  const isFeatured = sectionTitle === Copy.events.upcoming && index === 0;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(index * 80).duration(400)}
    >
      <AnimatedPressable pressScale={0.98}>
        <EventCard
          eventId={item.id}
          title={item.title}
          bellTime={item.bell_time}
          isHost={item.host_user_id === userId}
          location={shortLocation(item)}
          addressLine1={item.address_line1}
          city={item.city}
          featured={isFeatured}
          goingCount={isDemoSection ? 5 : undefined}
          maybeCount={isDemoSection ? 2 : undefined}
          unclaimedBringCount={isDemoSection ? 3 : undefined}
        />
      </AnimatedPressable>
    </Animated.View>
  );
});

export default function EventsScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, isLoading, error: queryError, refetch, isRefetching } = useEvents(user?.id);
  const upcomingEvents = data?.upcoming ?? [];
  const pastEvents = data?.past ?? [];
  const loading = isLoading;
  const refreshing = isRefetching;
  const error = queryError?.message ?? null;
  const [demoEvent, setDemoEvent] = useState<EventWithDetails | null>(null);
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion();

  const handleCreateDemo = useCallback(() => {
    const demo = createDemoEvent();
    setDemoEvent(demo);
    toast.show(Copy.events.demoCreated);
  }, [toast]);

  // Build sections for SectionList
  const sections: SectionData[] = [];

  if (demoEvent && upcomingEvents.length === 0) {
    sections.push({
      title: Copy.common.demoPreview,
      data: [demoEvent],
      isDemoSection: true,
    });
  }

  if (upcomingEvents.length > 0) {
    sections.push({
      title: Copy.events.upcoming,
      badge: upcomingEvents.length,
      data: upcomingEvents,
    });
  }

  if (pastEvents.length > 0) {
    sections.push({
      title: Copy.events.past,
      badge: pastEvents.length,
      data: pastEvents,
    });
  }

  const allEmpty = upcomingEvents.length === 0 && !demoEvent;

  const renderSectionHeader = ({ section }: { section: SectionData }) => (
    <View style={[styles.sectionHeader, { borderLeftColor: colors.primaryBrand }]}>
      <FontAwesome name="bookmark-o" size={14} color={colors.primaryBrand} />
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {section.title}
      </Text>
      {section.badge != null && (
        <View style={[styles.badge, { backgroundColor: colors.primaryBrandFaint, borderColor: colors.primaryBrand }]}>
          <Text style={[styles.badgeText, { color: colors.primaryBrand }]}>
            {section.badge}
          </Text>
        </View>
      )}
      {section.isDemoSection && (
        <GhostButton onPress={() => setDemoEvent(null)} textStyle={{ fontSize: typography.small }}>
          {Copy.common.dismiss}
        </GhostButton>
      )}
    </View>
  );

  const renderItem = ({ item, index, section }: { item: EventWithDetails; index: number; section: SectionData }) => (
    <SectionEventItem
      item={item}
      index={index}
      sectionTitle={section.title}
      isDemoSection={section.isDemoSection}
      reduceMotion={reduceMotion}
      userId={user?.id}
    />
  );

  return (
    <AppShell>
      {loading ? (
        <View style={styles.loadingContainer}>
          <PageHeader
            title={Copy.events.title}
            subtitle={Copy.events.subtitle}
            actions={
              <View style={styles.headerActions}>
                <Link href="/create" asChild>
                  <PrimaryButton>Create Dinner</PrimaryButton>
                </Link>
              </View>
            }
          />
          <SkeletonCardList count={3} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <PageHeader title={Copy.events.title} subtitle={Copy.events.subtitle} />
          <Card style={styles.errorCard}>
            <CardBody>
              <FontAwesome name="exclamation-circle" size={20} color={colors.error} />
              <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>{error}</Text>
              <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
                Pull down to refresh and try again.
              </Text>
            </CardBody>
          </Card>
        </View>
      ) : allEmpty ? (
        <View style={styles.emptyContainer}>
          <PageHeader
            title={Copy.events.title}
            subtitle={Copy.events.subtitle}
            actions={
              <View style={styles.headerActions}>
                <Link href="/create" asChild>
                  <PrimaryButton>Create Dinner</PrimaryButton>
                </Link>
              </View>
            }
          />
          <EmptyState
            variant="events"
            headline={Copy.events.noUpcoming}
            body={Copy.events.noUpcomingBody}
            primaryCta={
              <Link href="/create" asChild>
                <PrimaryButton>{Copy.common.createDinner}</PrimaryButton>
              </Link>
            }
            secondaryCta={
              <SecondaryButton onPress={handleCreateDemo}>{Copy.events.seeDemo}</SecondaryButton>
            }
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            user ? (
              <RefreshControl refreshing={refreshing} onRefresh={() => refetch()} tintColor={colors.tint} />
            ) : undefined
          }
          ListHeaderComponent={
            <PageHeader
              title={Copy.events.title}
              subtitle={Copy.events.subtitle}
              actions={
                <View style={styles.headerActions}>
                  <Link href="/create" asChild>
                    <PrimaryButton>Create Dinner</PrimaryButton>
                  </Link>
                </View>
              }
            />
          }
          ListFooterComponent={<View style={{ height: spacing.xxl * 2 }} />}
        />
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    borderLeftWidth: 4,
    marginLeft: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.headline,
    fontWeight: fontWeight.semibold,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.chip,
    minWidth: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  badgeText: {
    fontSize: typography.microLabel,
    fontWeight: fontWeight.bold,
  },
  errorContainer: {
    flex: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  errorCard: {
    width: '100%',
    maxWidth: 520,
  },
  errorTitle: {
    fontSize: typography.headline,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorBody: {
    fontSize: typography.body,
    textAlign: 'center',
    lineHeight: lineHeight.meta,
  },
});

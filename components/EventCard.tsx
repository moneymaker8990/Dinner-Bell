import { AnimatedPressable } from '@/components/AnimatedPressable';
import { IconButton } from '@/components/Buttons';
import { Card } from '@/components/Card';
import { DinnerTriangleIcon } from '@/components/DinnerTriangleIcon';
import { StatPill } from '@/components/StatPill';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fontFamily, getElevation, radius, spacing, typography } from '@/constants/Theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet } from 'react-native';

export interface EventCardProps {
  eventId: string;
  title: string;
  bellTime: string;
  isHost?: boolean;
  location?: string | null;
  goingCount?: number;
  maybeCount?: number;
  unclaimedBringCount?: number;
  inviteToken?: string;
  addressLine1?: string;
  city?: string;
  featured?: boolean;
}

export function formatCountdown(bellTime: string): { text: string; within24h: boolean } {
  const bell = new Date(bellTime);
  const now = new Date();
  const diff = bell.getTime() - now.getTime();
  if (diff <= 0) return { text: 'Past', within24h: false };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const within24h = hours < 24;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return { text: `${days}d ${hours % 24}h`, within24h: false };
  }
  return { text: `${hours}h ${mins}m`, within24h: true };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} at ${time}`;
}

function openMaps(addressLine1?: string, city?: string) {
  const q = [addressLine1, city].filter(Boolean).join(', ');
  if (!q.trim()) return;
  const url =
    Platform.OS === 'ios'
      ? `maps:?q=${encodeURIComponent(q)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  Linking.openURL(url).catch(() => {});
}

export const EventCard = React.memo(function EventCard({
  eventId,
  title,
  bellTime,
  isHost,
  location,
  goingCount,
  maybeCount,
  unclaimedBringCount,
  inviteToken,
  addressLine1,
  city,
  featured,
}: EventCardProps) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { text: countdownText, within24h } = formatCountdown(bellTime);
  const hasAddress = !!(addressLine1 || city);
  const [showMenu, setShowMenu] = useState(false);

  const handleNavigate = () => {
    if (hasAddress) openMaps(addressLine1, city);
  };

  const handleCopyInvite = async () => {
    const link = inviteToken
      ? `dinnerbell://invite/${eventId}?token=${inviteToken}`
      : `dinnerbell://event/${eventId}`;
    await Clipboard.setStringAsync(link);
    setShowMenu(false);
  };

  return (
    <AnimatedPressable
      enableHaptics
      pressScale={0.985}
      style={styles.cardOuter}
      onPress={() => router.push(`/event/${eventId}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open event ${title}`}
    >
      <Card style={{ ...styles.card, ...(featured ? styles.cardFeatured : {}) }}>
        {/* Accent bar for featured */}
        {featured && (
          <View style={[styles.accentBar, { backgroundColor: colors.tint }]} />
        )}

        <View style={styles.cardContent}>
          <View style={styles.topRow}>
            <View style={styles.main}>
              <Text style={[styles.title, featured && styles.titleFeatured]} numberOfLines={2}>
                {title}
              </Text>
              <View style={styles.metaRow}>
                <FontAwesome name="calendar-o" size={12} color={colors.textSecondary} />
                <Text style={[styles.dateTime, { color: colors.textSecondary }]}>
                  {formatDateTime(bellTime)}
                </Text>
              </View>
              {location ? (
                <View style={styles.metaRow}>
                  <FontAwesome name="map-marker" size={12} color={colors.textSecondary} />
                  <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
                    {location}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.actions}>
              {hasAddress && (
                <IconButton
                  onPress={handleNavigate}
                  icon={<FontAwesome name="map-marker" size={18} color={colors.tint} />}
                  accessibilityLabel="Navigate to event"
                />
              )}
              <IconButton
                onPress={() => setShowMenu(!showMenu)}
                icon={<FontAwesome name="ellipsis-h" size={18} color={colors.textSecondary} />}
                accessibilityLabel="More options"
              />
            </View>
          </View>

          <View style={styles.pills}>
            {(goingCount != null || maybeCount != null) && (
              <StatPill
                variant="sage"
                label={`Going ${goingCount ?? 0} \u00B7 Maybe ${maybeCount ?? 0}`}
              />
            )}
            {unclaimedBringCount != null && unclaimedBringCount > 0 && (
              <StatPill label={`${unclaimedBringCount} items unclaimed`} />
            )}
            {within24h && countdownText !== 'Past' && (
              <View style={[styles.countdownChip, { backgroundColor: colorScheme === 'dark' ? 'rgba(232,197,71,0.22)' : 'rgba(184,134,11,0.14)', borderColor: colorScheme === 'dark' ? 'rgba(232,197,71,0.45)' : 'rgba(184,134,11,0.28)', shadowColor: colors.shadow }]}>
                <DinnerTriangleIcon size={14} color={colors.tint} />
                <Text style={[styles.countdownText, { color: colors.tint }]}>in {countdownText}</Text>
              </View>
            )}
            {!within24h && countdownText !== 'Past' && (
              <StatPill label={countdownText} />
            )}
          </View>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
              onPress={() => router.push(`/event/${eventId}`)}
              accessibilityRole="button"
              accessibilityLabel="View event"
            >
              <FontAwesome name="eye" size={14} color={colors.tint} style={styles.footerBtnIcon} />
              <Text style={[styles.footerBtnText, { color: colors.tint }]}>View</Text>
            </Pressable>
            {isHost && (
              <Pressable
                style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
                onPress={() => router.push(`/event/${eventId}/bell`)}
                accessibilityRole="button"
                accessibilityLabel="Ring dinner bell"
              >
                <DinnerTriangleIcon size={14} color={colors.tint} />
                <Text style={[styles.footerBtnText, { color: colors.tint }]}>Ring Bell</Text>
              </Pressable>
            )}
            {isHost && (
              <Pressable
                style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
                onPress={() => router.push(`/event/${eventId}/edit`)}
                accessibilityRole="button"
                accessibilityLabel="Edit event"
              >
                <FontAwesome name="pencil" size={14} color={colors.textSecondary} style={styles.footerBtnIcon} />
                <Text style={[styles.footerBtnText, { color: colors.textSecondary }]}>Edit</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Quick menu overlay */}
        {showMenu && (
          <View style={[styles.menuOverlay, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }, getElevation('raised', colors.shadow)]}>
            <Pressable style={styles.menuItem} onPress={() => { router.push(`/event/${eventId}/edit`); setShowMenu(false); }} accessibilityRole="button" accessibilityLabel="Edit event">
              <FontAwesome name="pencil" size={14} color={colors.textPrimary} />
              <Text style={[styles.menuText, { color: colors.textPrimary }]}>Edit</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleCopyInvite} accessibilityRole="button" accessibilityLabel="Copy invite link">
              <FontAwesome name="link" size={14} color={colors.textPrimary} />
              <Text style={[styles.menuText, { color: colors.textPrimary }]}>Copy invite link</Text>
            </Pressable>
          </View>
        )}
      </Card>
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  cardOuter: {
    marginVertical: spacing.sm,
    ...getElevation('raised', '#000000'),
  },
  card: {
    overflow: 'hidden',
  },
  cardFeatured: {
    borderWidth: 0,
  },
  accentBar: {
    height: 5,
    width: '100%',
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
  },
  cardContent: {
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: typography.h3,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  titleFeatured: {
    fontSize: typography.h2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dateTime: {
    fontSize: typography.caption,
  },
  location: {
    fontSize: typography.caption,
  },
  actions: {
    flexDirection: 'row',
    gap: 0,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
    borderWidth: 1,
    ...getElevation('raised', '#000000'),
  },
  countdownText: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  footerBtnPressed: {
    opacity: 0.7,
  },
  footerBtnIcon: {
    width: 16,
  },
  footerBtnText: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  menuOverlay: {
    position: 'absolute',
    top: spacing.xxl + spacing.lg,
    right: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.input,
    padding: spacing.xs,
    zIndex: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minWidth: 160,
  },
  menuText: {
    fontSize: typography.body,
  },
});

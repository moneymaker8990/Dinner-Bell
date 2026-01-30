import { AppShell } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Divider } from '@/components/Divider';
import { PageHeader } from '@/components/PageHeader';
import { SettingsRow } from '@/components/SettingsRow';
import { StatPill } from '@/components/StatPill';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { normalizePhoneForLookup } from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';

function initialsFromEmail(email: string | undefined): string {
  if (!email) return '?';
  const part = email.split('@')[0];
  if (part.length >= 2) return part.slice(0, 2);
  return part.slice(0, 1) + part.slice(0, 1);
}

function displayName(email: string | undefined): string {
  if (!email) return 'Guest';
  const part = email.split('@')[0];
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isSignedIn } = useAuth();
  const toast = useToast();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [reminderMins, setReminderMins] = useState(30);
  const [bellSoundOn, setBellSoundOn] = useState(true);
  const [vibrateOnBell, setVibrateOnBell] = useState(true);
  const [showRsvpToOthers, setShowRsvpToOthers] = useState(true);

  // Stats
  const [hostedCount, setHostedCount] = useState(0);
  const [attendedCount, setAttendedCount] = useState(0);
  const [claimedCount, setClaimedCount] = useState(0);

  const [profilePhone, setProfilePhone] = useState('');
  const [profilePhoneSaving, setProfilePhoneSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('phone').eq('id', user.id).single();
      setProfilePhone((data as { phone?: string } | null)?.phone ?? '');
    };
    fetchProfile();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const { count: hosted } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('host_user_id', user.id)
          .eq('is_cancelled', false);
        setHostedCount(hosted ?? 0);

        const { data: guestRows } = await supabase
          .from('event_guests')
          .select('id')
          .eq('user_id', user.id)
          .eq('rsvp_status', 'going');
        const guestIds = (guestRows ?? []).map((r: { id: string }) => r.id);
        const { data: eventIdsData } = await supabase
          .from('event_guests')
          .select('event_id')
          .eq('user_id', user.id)
          .eq('rsvp_status', 'going');
        const goingEventIds = [...new Set((eventIdsData ?? []).map((r: { event_id: string }) => r.event_id))];
        const attended =
          goingEventIds.length === 0
            ? 0
            : (
                await supabase
                  .from('events')
                  .select('id', { count: 'exact', head: true })
                  .in('id', goingEventIds)
                  .eq('is_cancelled', false)
              ).count ?? 0;
        setAttendedCount(attended);

        if (guestIds.length === 0) {
          setClaimedCount(0);
          return;
        }
        const { count: brought } = await supabase
          .from('bring_items')
          .select('id', { count: 'exact', head: true })
          .in('status', ['claimed', 'provided'])
          .in('claimed_by_guest_id', guestIds);
        setClaimedCount(brought ?? 0);
      } catch {
        setHostedCount(0);
        setAttendedCount(0);
        setClaimedCount(0);
      }
    };
    fetchStats();
  }, [user?.id]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.show('Signed out. Come back hungry.');
  };

  const handleSavePhone = async () => {
    if (!user) return;
    const normalized = normalizePhoneForLookup(profilePhone);
    if (normalized.length > 0 && normalized.length < 10) {
      toast.show('Enter a valid phone number (at least 10 digits).');
      return;
    }
    setProfilePhoneSaving(true);
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ phone: normalized || null, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setProfilePhoneSaving(false);
    if (error) toast.show('Could not save phone number.');
    else toast.show(normalized ? 'Phone number saved. Hosts can invite you by this number.' : 'Phone number cleared.');
  };


  const subtitle = isSignedIn
    ? `${user?.email ?? 'Signed in'}`
    : 'Sign in to create and manage events';

  return (
    <AppShell>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PageHeader title="Profile" subtitle={subtitle} />

        {isSignedIn ? (
          <>
            {/* Hero Card */}
            <Card style={styles.heroCard}>
              <CardBody>
                <View style={styles.heroRow}>
                  <Avatar initials={initialsFromEmail(user?.email)} size={72} />
                  <View style={styles.heroInfo}>
                    <Text style={[styles.heroName, { color: colors.textPrimary }]}>
                      {displayName(user?.email)}
                    </Text>
                    <Text style={[styles.heroEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                      {user?.email ?? ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <FontAwesome name="bullhorn" size={14} color={colors.tint} style={styles.statIcon} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{hostedCount}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Hosted</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.statItem}>
                    <FontAwesome name="check-circle" size={14} color={colors.accentSage} style={styles.statIcon} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{attendedCount}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Attended</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.statItem}>
                    <FontAwesome name="gift" size={14} color={colors.tint} style={styles.statIcon} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{claimedCount}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Items brought</Text>
                  </View>
                </View>
                {(hostedCount >= 1 || claimedCount >= 10 || attendedCount >= 3) && (
                  <View style={styles.badgesRow}>
                    <Text style={[styles.badgesLabel, { color: colors.textSecondary }]}>Badges</Text>
                    <View style={styles.badgeChips}>
                      {hostedCount >= 1 && (
                        <View style={[styles.badgeChip, { backgroundColor: colors.tint + '24', borderColor: colors.tint + '60' }]}>
                          <Text style={[styles.badgeChipText, { color: colors.tint }]}>Dinner host</Text>
                        </View>
                      )}
                      {claimedCount >= 10 && (
                        <View style={[styles.badgeChip, { backgroundColor: colors.accentSage + '24', borderColor: colors.accentSage + '60' }]}>
                          <Text style={[styles.badgeChipText, { color: colors.accentSage }]}>Super bringer</Text>
                        </View>
                      )}
                      {attendedCount >= 3 && (
                        <View style={[styles.badgeChip, { backgroundColor: colors.border }]}>
                          <Text style={[styles.badgeChipText, { color: colors.textSecondary }]}>Regular</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </CardBody>
            </Card>

            {/* Notifications */}
            <Card style={styles.settingsCard}>
              <CardHeader title="Notifications" />
              <CardBody style={styles.cardBodyNoTopPadding}>
                <SettingsRow
                  title="Default reminders"
                  subtitle="Give people a gentle nudge before you ring."
                  icon={<FontAwesome name="bell-o" size={16} color={colors.tint} />}
                  right={
                    <StatPill label={`${reminderMins}m`} />
                  }
                />
                <Divider />
                <SettingsRow
                  title="Bell sound"
                  subtitle="Plays the triangle ding when it's time."
                  icon={<FontAwesome name="music" size={16} color={colors.tint} />}
                  right={<Switch value={bellSoundOn} onValueChange={setBellSoundOn} trackColor={{ false: colors.border, true: colors.tint }} thumbColor="#fff" />}
                />
                <Divider />
                <SettingsRow
                  title="Vibrate on bell"
                  subtitle="Feel it when the bell rings."
                  icon={<FontAwesome name="mobile" size={16} color={colors.tint} />}
                  right={<Switch value={vibrateOnBell} onValueChange={setVibrateOnBell} trackColor={{ false: colors.border, true: colors.tint }} thumbColor="#fff" />}
                />
              </CardBody>
            </Card>

            {/* Defaults */}
            <Card style={styles.settingsCard}>
              <CardHeader title="Defaults" />
              <CardBody style={styles.cardBodyNoTopPadding}>
                <SettingsRow
                  title="Default event duration"
                  icon={<FontAwesome name="clock-o" size={16} color={colors.tint} />}
                  right={<StatPill label="2 hours" />}
                />
                <Divider />
                <SettingsRow
                  title="Bell follows start time"
                  subtitle="Ring right when the event begins."
                  icon={<FontAwesome name="refresh" size={16} color={colors.tint} />}
                  right={<StatPill variant="sage" label="On" />}
                />
                <Divider />
                <SettingsRow
                  title="Default address"
                  subtitle="Manage your saved locations."
                  icon={<FontAwesome name="map-marker" size={16} color={colors.tint} />}
                  right={<Text style={[styles.settingLink, { color: colors.tint }]}>Manage</Text>}
                />
                <Divider />
                <Pressable onPress={() => router.push('/groups')}>
                  <SettingsRow
                    title="Guest groups"
                    subtitle="Reuse the same guest list for future events."
                    icon={<FontAwesome name="users" size={16} color={colors.tint} />}
                    right={<Text style={[styles.settingLink, { color: colors.tint }]}>Manage</Text>}
                  />
                </Pressable>
              </CardBody>
            </Card>

            {/* Privacy */}
            <Card style={styles.settingsCard}>
              <CardHeader title="Privacy" />
              <CardBody style={styles.cardBodyNoTopPadding}>
                <SettingsRow
                  title="Show my RSVP to others"
                  subtitle="Let other guests see if you're going."
                  icon={<FontAwesome name="eye" size={16} color={colors.tint} />}
                  right={<Switch value={showRsvpToOthers} onValueChange={setShowRsvpToOthers} trackColor={{ false: colors.border, true: colors.tint }} thumbColor="#fff" />}
                />
              </CardBody>
            </Card>

            {/* Account */}
            <Card style={styles.settingsCard}>
              <CardHeader title="Account" />
              <CardBody style={styles.cardBodyNoTopPadding}>
                <View style={styles.phoneRow}>
                  <FontAwesome name="phone" size={16} color={colors.textSecondary} style={styles.phoneIcon} />
                  <Text style={[styles.phoneLabel, { color: colors.textPrimary }]}>Phone number</Text>
                </View>
                <Text style={[styles.phoneSubtitle, { color: colors.textSecondary }]}>
                  So hosts can add you from their contacts and send you invite push notifications.
                </Text>
                <TextInput
                  style={[styles.phoneInput, { borderColor: colors.border, color: colors.textPrimary }]}
                  value={profilePhone}
                  onChangeText={setProfilePhone}
                  placeholder="+1 234 567 8900"
                  placeholderTextColor="#888"
                  keyboardType="phone-pad"
                  onBlur={handleSavePhone}
                  editable={!profilePhoneSaving}
                />
                {profilePhoneSaving ? <Text style={[styles.phoneHint, { color: colors.textSecondary }]}>Saving...</Text> : null}
                <Divider />
                <SettingsRow
                  title="Change email"
                  subtitle="Update your email address."
                  icon={<FontAwesome name="envelope-o" size={16} color={colors.textSecondary} />}
                  right={<StatPill label="Soon" />}
                />
                <Divider />
                <SettingsRow
                  title="Change password"
                  subtitle="Update your password."
                  icon={<FontAwesome name="lock" size={16} color={colors.textSecondary} />}
                  right={<StatPill label="Soon" />}
                />
                <Divider />
                <View style={styles.signOutWrap}>
                  <GhostButton
                    onPress={handleSignOut}
                    style={{ ...styles.signOutBtn, borderColor: colors.accentTomato }}
                    textStyle={{ color: colors.accentTomato }}
                  >
                    Sign out
                  </GhostButton>
                </View>
              </CardBody>
            </Card>
          </>
        ) : (
          <Card style={styles.signInCard}>
            <CardBody>
              <View style={styles.signInContent}>
                <FontAwesome name="user-circle-o" size={48} color={colors.tint + '60'} />
                <Text style={[styles.signInText, { color: colors.textSecondary }]}>
                  Sign in to create and manage events, see your stats, and customize notifications.
                </Text>
                <PrimaryButton onPress={() => router.push('/sign-in')}>
                  Sign in
                </PrimaryButton>
              </View>
            </CardBody>
          </Card>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl * 2 },
  heroCard: {
    marginBottom: spacing.xl,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontSize: typography.h2,
    fontWeight: '600',
  },
  heroEmail: {
    fontSize: typography.caption,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E8E1D8',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.h2,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: typography.small,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    opacity: 0.5,
  },
  badgesRow: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  badgesLabel: {
    fontSize: typography.small,
    marginBottom: spacing.sm,
  },
  badgeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  badgeChipText: {
    fontSize: typography.small,
    fontWeight: '600',
  },
  settingsCard: {
    marginBottom: spacing.xl,
  },
  cardBodyNoTopPadding: {
    paddingTop: 0,
  },
  settingLink: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
  signOutWrap: {
    marginTop: spacing.md,
    alignItems: 'flex-start',
  },
  signOutBtn: {
    borderWidth: 1,
    minHeight: 44,
  },
  signInCard: {
    marginTop: spacing.lg,
  },
  signInContent: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  signInText: {
    fontSize: typography.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  phoneIcon: {
    marginRight: spacing.sm,
  },
  phoneLabel: {
    fontSize: typography.body,
    fontWeight: '500',
  },
  phoneSubtitle: {
    fontSize: typography.small,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  phoneInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
    marginBottom: spacing.xs,
  },
  phoneHint: {
    fontSize: typography.small,
    marginBottom: spacing.md,
  },
});

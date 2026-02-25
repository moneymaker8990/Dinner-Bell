import { AnimatedPressable } from '@/components/AnimatedPressable';
import { AppShell } from '@/components/AppShell';
import { Avatar } from '@/components/Avatar';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Divider } from '@/components/Divider';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { GradientHeader } from '@/components/GradientHeader';
import { OptimizedImage } from '@/components/OptimizedImage';
import { SettingsRow } from '@/components/SettingsRow';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { StatPill } from '@/components/StatPill';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { fontWeight, lineHeight, radius, spacing, typography } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useProfile } from '@/hooks/useProfile';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { trackProfileUpdated, trackSignOut } from '@/lib/analytics';
import { hapticSuccess } from '@/lib/haptics';
import { normalizePhoneForLookup } from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Switch } from 'react-native';
import Animated, { FadeInDown, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';

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

const PROFILE_DEFAULTS_KEY = 'profile_ui_defaults_v1';

/** Animated count-up stat using Reanimated shared values. */
function AnimatedStat({ value, style }: { value: number; style?: any }) {
  const reduceMotion = useReducedMotion();
  const sv = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduceMotion || value === 0) {
      sv.value = value;
      setDisplay(value);
      return;
    }
    sv.value = 0;
    sv.value = withTiming(value, { duration: 800 });
  }, [value, reduceMotion]);

  useAnimatedReaction(
    () => Math.round(sv.value),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setDisplay)(cur);
    }
  );

  return <Text style={style}>{display}</Text>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isSignedIn } = useAuth();
  const toast = useToast();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion();

  const [reminderMins, setReminderMins] = useState(30);
  const [bellSoundOn, setBellSoundOn] = useState(true);
  const [vibrateOnBell, setVibrateOnBell] = useState(true);
  const [showRsvpToOthers, setShowRsvpToOthers] = useState(true);

  // Stats (via React Query)
  const { data: profileData, isLoading: statsLoading, error: profileError, refetch: refetchProfile } = useProfile(user?.id);
  const statsError = profileError?.message ?? null;
  const hostedCount = profileData?.stats.hosted ?? 0;
  const attendedCount = profileData?.stats.attended ?? 0;
  const claimedCount = profileData?.stats.claimed ?? 0;

  const [profilePhone, setProfilePhone] = useState('');
  const [profilePhoneSaving, setProfilePhoneSaving] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const privacyPolicyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://dinner-bell-app.vercel.app/privacy';
  const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://dinner-bell-app.vercel.app/terms';
  const supportUrl = process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'mailto:support@dinnerbell.app';

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('phone, avatar_url').eq('id', user.id).single();
      setProfilePhone((data as { phone?: string } | null)?.phone ?? '');
      setAvatarUri((data as { avatar_url?: string | null } | null)?.avatar_url ?? null);
    };
    fetchProfile();
  }, [user?.id]);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_DEFAULTS_KEY).then((stored) => {
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as {
          reminderMins?: number;
          bellSoundOn?: boolean;
          vibrateOnBell?: boolean;
          showRsvpToOthers?: boolean;
        };
        if (typeof parsed.reminderMins === 'number') setReminderMins(parsed.reminderMins);
        if (typeof parsed.bellSoundOn === 'boolean') setBellSoundOn(parsed.bellSoundOn);
        if (typeof parsed.vibrateOnBell === 'boolean') setVibrateOnBell(parsed.vibrateOnBell);
        if (typeof parsed.showRsvpToOthers === 'boolean') setShowRsvpToOthers(parsed.showRsvpToOthers);
      } catch {
        // Ignore invalid cache entries.
      }
    });
  }, []);

  useEffect(() => {
    const next = JSON.stringify({
      reminderMins,
      bellSoundOn,
      vibrateOnBell,
      showRsvpToOthers,
    });
    AsyncStorage.setItem(PROFILE_DEFAULTS_KEY, next);
  }, [reminderMins, bellSoundOn, vibrateOnBell, showRsvpToOthers]);

  const openExternalLink = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        toast.show(Copy.toast.linkOpenFailed);
        return;
      }
      await Linking.openURL(url);
    } catch {
      toast.show(Copy.toast.linkOpenFailed);
    }
  };

  const pickImage = async () => {
    if (!user || avatarUploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const image = result.assets[0];
      const extension = image.fileName?.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filePath = `${user.id}/avatar.${extension}`;
      const previousAvatarUri = avatarUri;
      setAvatarUploading(true);

      try {
        setAvatarUri(image.uri);
        const response = await fetch(image.uri);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, blob, {
          contentType: image.mimeType ?? 'image/jpeg',
          upsert: true,
        });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        const nextAvatarUrl = publicUrlData.publicUrl;
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: nextAvatarUrl, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        if (updateError) throw updateError;

        setAvatarUri(nextAvatarUrl);
        trackProfileUpdated('avatar');
        toast.show(Copy.toast.profilePhotoUpdated);
      } catch {
        setAvatarUri(previousAvatarUri);
        toast.show(Copy.toast.profilePhotoUpdateFailed);
      } finally {
        setAvatarUploading(false);
      }
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      Copy.profile.signOutTitle,
      Copy.profile.signOutBody,
      [
        { text: Copy.common.cancel, style: 'cancel' },
        {
          text: Copy.profile.signOutTitle,
          style: 'destructive',
          onPress: async () => {
            trackSignOut();
            await supabase.auth.signOut();
            toast.show(Copy.toast.signedOut);
          },
        },
      ]
    );
  };

  const handleSavePhone = async () => {
    if (!user) return;
    const normalized = normalizePhoneForLookup(profilePhone);
    if (normalized.length > 0 && normalized.length < 10) {
      toast.show(Copy.toast.invalidPhone);
      return;
    }
    setProfilePhoneSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ phone: normalized || null, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setProfilePhoneSaving(false);
    if (error) toast.show(Copy.toast.phoneSaveFailed);
    else {
      trackProfileUpdated('phone');
      hapticSuccess();
      toast.show(normalized ? Copy.toast.phoneSaved : Copy.toast.phoneCleared);
    }
  };

  const handleUpdateEmail = async () => {
    if (!user || accountSaving) return;
    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      toast.show(Copy.auth.invalidEmailFormat);
      return;
    }

    setAccountSaving(true);
    const { error } = await supabase.auth.updateUser({ email: trimmedEmail });
    setAccountSaving(false);
    if (error) {
      toast.show(Copy.toast.accountUpdateFailed);
      return;
    }
    trackProfileUpdated('email');
    hapticSuccess();
    setNewEmail('');
    setShowEmailForm(false);
    toast.show(Copy.toast.emailUpdateSent);
  };

  const handleUpdatePassword = async () => {
    if (!user || accountSaving) return;
    if (!newPassword || newPassword.length < 6) {
      toast.show(Copy.auth.passwordTooShort);
      return;
    }

    setAccountSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setAccountSaving(false);
    if (error) {
      toast.show(Copy.toast.accountUpdateFailed);
      return;
    }
    trackProfileUpdated('password');
    hapticSuccess();
    setNewPassword('');
    setShowPasswordForm(false);
    toast.show(Copy.toast.passwordUpdated);
  };

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await refetchProfile();
    setRefreshing(false);
  };


  const subtitle = isSignedIn
    ? `${user?.email ?? 'Signed in'}`
    : Copy.profile.signInPrompt;

  return (
    <AppShell>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isSignedIn ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.tint} /> : undefined
        }
      >
        <GradientHeader
          title={isSignedIn ? displayName(user?.email) : Copy.profile.title}
          subtitle={subtitle}
          height={180}
        />

        {isSignedIn ? (
          <>
            {/* Hero Card */}
            <Card style={styles.heroCard}>
              <CardBody>
                <View style={styles.heroRow}>
                  <Pressable
                    onPress={pickImage}
                    style={styles.avatarWrapper}
                    accessibilityLabel={avatarUploading ? 'Uploading profile photo' : 'Change profile photo'}
                    accessibilityRole="button"
                    disabled={avatarUploading}
                  >
                    {avatarUri ? (
                      <OptimizedImage
                        source={avatarUri}
                        width={80}
                        height={80}
                        borderRadius={40}
                      />
                    ) : (
                      <Avatar initials={initialsFromEmail(user?.email)} size={80} />
                    )}
                    <View style={[styles.cameraOverlay, { backgroundColor: colors.overlay, borderColor: colors.onOverlay }]}>
                      <FontAwesome name="camera" size={12} color={colors.onOverlay} />
                    </View>
                  </Pressable>
                  <View style={styles.heroInfo}>
                    <Text style={[styles.heroName, { color: colors.textPrimary }]} accessibilityRole="header">
                      {displayName(user?.email)}
                    </Text>
                    <Text style={[styles.heroEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                      {user?.email ?? ''}
                    </Text>
                  </View>
                </View>
                <Animated.View
                  entering={reduceMotion ? undefined : FadeInDown.duration(400)}
                  style={[styles.statsRow, { borderTopColor: colors.border }]}
                >
                  <Animated.View
                    entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(400)}
                    style={styles.statItem}
                  >
                    <FontAwesome name="bullhorn" size={14} color={colors.tint} style={styles.statIcon} />
                    {statsLoading ? (
                      <SkeletonLoader width={32} height={22} borderRadius={6} style={styles.statSkeleton} />
                    ) : (
                      <AnimatedStat value={hostedCount} style={[styles.statValue, { color: colors.textPrimary }]} />
                    )}
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{Copy.profile.hosted}</Text>
                  </Animated.View>
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <Animated.View
                    entering={reduceMotion ? undefined : FadeInDown.delay(250).duration(400)}
                    style={styles.statItem}
                  >
                    <FontAwesome name="check-circle" size={14} color={colors.accentSage} style={styles.statIcon} />
                    {statsLoading ? (
                      <SkeletonLoader width={32} height={22} borderRadius={6} style={styles.statSkeleton} />
                    ) : (
                      <AnimatedStat value={attendedCount} style={[styles.statValue, { color: colors.textPrimary }]} />
                    )}
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{Copy.profile.attended}</Text>
                  </Animated.View>
                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                  <Animated.View
                    entering={reduceMotion ? undefined : FadeInDown.delay(400).duration(400)}
                    style={styles.statItem}
                  >
                    <FontAwesome name="gift" size={14} color={colors.tint} style={styles.statIcon} />
                    {statsLoading ? (
                      <SkeletonLoader width={32} height={22} borderRadius={6} style={styles.statSkeleton} />
                    ) : (
                      <AnimatedStat value={claimedCount} style={[styles.statValue, { color: colors.textPrimary }]} />
                    )}
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{Copy.profile.claimed}</Text>
                  </Animated.View>
                </Animated.View>
                {statsError ? (
                  <View style={styles.statsErrorWrap}>
                    <Text style={[styles.statsErrorText, { color: colors.textSecondary }]}>
                      {statsError}
                    </Text>
                    <GhostButton onPress={() => refetchProfile()} textStyle={{ color: colors.tint }}>
                      {Copy.profile.statsRetry}
                    </GhostButton>
                  </View>
                ) : null}
                {(hostedCount >= 1 || claimedCount >= 10 || attendedCount >= 3) && (
                  <View style={[styles.badgesRow, { borderTopColor: colors.border }]}>
                    <Text style={[styles.badgesLabel, { color: colors.textSecondary }]}>{Copy.profile.badges}</Text>
                    <View style={styles.badgeChips}>
                      {hostedCount >= 1 && (
                        <View style={[styles.badgeChip, { backgroundColor: colors.tintSoft, borderColor: colors.tintMuted }]}>
                          <Text style={[styles.badgeChipText, { color: colors.tint }]}>{Copy.profile.badgeHost}</Text>
                        </View>
                      )}
                      {claimedCount >= 10 && (
                        <View style={[styles.badgeChip, { backgroundColor: colors.accentSageFaint, borderColor: colors.accentSageBorder }]}>
                          <Text style={[styles.badgeChipText, { color: colors.accentSage }]}>{Copy.profile.badgeSuperBringer}</Text>
                        </View>
                      )}
                      {attendedCount >= 3 && (
                        <View style={[styles.badgeChip, { backgroundColor: colors.border }]}>
                          <Text style={[styles.badgeChipText, { color: colors.textSecondary }]}>{Copy.profile.badgeRegular}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </CardBody>
            </Card>

            {/* Notifications */}
            <Card style={styles.settingsCard}>
              <CardHeader title={Copy.profile.notifications} />
              <CardBody style={styles.cardBodyNoTopPadding}>
                <SettingsRow
                  title={Copy.profile.defaultReminders}
                  subtitle={Copy.profile.defaultRemindersDesc}
                  icon={<FontAwesome name="bell-o" size={16} color={colors.tint} />}
                  right={
                    <StatPill label={`${reminderMins}m`} />
                  }
                />
                <Divider />
                <SettingsRow
                  title={Copy.profile.bellSound}
                  subtitle={Copy.profile.bellSoundDesc}
                  icon={<FontAwesome name="music" size={16} color={colors.tint} />}
                  right={<Switch value={bellSoundOn} onValueChange={setBellSoundOn} trackColor={{ false: colors.border, true: colors.tint }} ios_backgroundColor={colors.border} thumbColor={bellSoundOn ? colors.primaryButtonText : colors.elevatedSurface} accessibilityLabel="Bell sound" />}
                />
                <Divider />
                <SettingsRow
                  title={Copy.profile.vibrateOnBell}
                  subtitle={Copy.profile.vibrateOnBellDesc}
                  icon={<FontAwesome name="mobile" size={16} color={colors.tint} />}
                  right={<Switch value={vibrateOnBell} onValueChange={setVibrateOnBell} trackColor={{ false: colors.border, true: colors.tint }} ios_backgroundColor={colors.border} thumbColor={vibrateOnBell ? colors.primaryButtonText : colors.elevatedSurface} accessibilityLabel="Vibrate on bell" />}
                />
              </CardBody>
            </Card>

            {/* Defaults */}
            <Card style={styles.settingsCard}>
              <CardHeader title={Copy.profile.defaults} />
              <CardBody style={styles.cardBodyNoTopPadding}>
                <SettingsRow
                  title={Copy.profile.defaultDuration}
                  icon={<FontAwesome name="clock-o" size={16} color={colors.tint} />}
                  right={<StatPill label={Copy.profile.twoHours} />}
                />
                <Divider />
                <SettingsRow
                  title={Copy.profile.bellFollowsStart}
                  subtitle={Copy.profile.bellFollowsStartDesc}
                  icon={<FontAwesome name="refresh" size={16} color={colors.tint} />}
                  right={<StatPill variant="sage" label="On" />}
                />
                <Divider />
                <SettingsRow
                  title={Copy.profile.defaultAddress}
                  subtitle={Copy.profile.defaultAddressDesc}
                  icon={<FontAwesome name="map-marker" size={16} color={colors.tint} />}
                  right={<Text style={[styles.settingLink, { color: colors.tint }]}>Manage</Text>}
                />
                <Divider />
                <AnimatedPressable onPress={() => router.push('/groups' as Href)}>
                  <SettingsRow
                    title={Copy.profile.guestGroups}
                    subtitle={Copy.profile.guestGroupsDesc}
                    icon={<FontAwesome name="users" size={16} color={colors.tint} />}
                    right={<Text style={[styles.settingLink, { color: colors.tint }]}>Manage</Text>}
                  />
                </AnimatedPressable>
              </CardBody>
            </Card>

            {/* Privacy */}
            <Card style={styles.settingsCard}>
              <CardHeader title={Copy.profile.privacy} />
              <CardBody style={styles.cardBodyNoTopPadding}>
                <SettingsRow
                  title={Copy.profile.showRsvp}
                  subtitle={Copy.profile.showRsvpDesc}
                  icon={<FontAwesome name="eye" size={16} color={colors.tint} />}
                  right={<Switch value={showRsvpToOthers} onValueChange={setShowRsvpToOthers} trackColor={{ false: colors.border, true: colors.tint }} ios_backgroundColor={colors.border} thumbColor={showRsvpToOthers ? colors.primaryButtonText : colors.elevatedSurface} accessibilityLabel="Show RSVP status to others" />}
                />
              </CardBody>
            </Card>

            {/* Legal and support */}
            <Card style={styles.settingsCard}>
              <CardHeader title={Copy.profile.legalSupport} />
              <CardBody style={styles.cardBodyNoTopPadding}>
                <SettingsRow
                  title={Copy.profile.privacyPolicy}
                  subtitle={Copy.profile.privacyPolicyDesc}
                  icon={<FontAwesome name="shield" size={16} color={colors.tint} />}
                  right={<Text style={[styles.settingLink, { color: colors.tint }]}>View</Text>}
                  onPress={() => openExternalLink(privacyPolicyUrl)}
                />
                <Divider />
                <SettingsRow
                  title={Copy.profile.termsOfService}
                  subtitle={Copy.profile.termsOfServiceDesc}
                  icon={<FontAwesome name="file-text-o" size={16} color={colors.tint} />}
                  right={<Text style={[styles.settingLink, { color: colors.tint }]}>View</Text>}
                  onPress={() => openExternalLink(termsUrl)}
                />
                <Divider />
                <SettingsRow
                  title={Copy.profile.contactSupport}
                  subtitle={Copy.profile.contactSupportDesc}
                  icon={<FontAwesome name="life-ring" size={16} color={colors.tint} />}
                  right={<Text style={[styles.settingLink, { color: colors.tint }]}>Email</Text>}
                  onPress={() => openExternalLink(supportUrl)}
                />
              </CardBody>
            </Card>

            {/* Account */}
            <Card style={styles.settingsCard}>
              <CardHeader title={Copy.profile.account} />
              <CardBody style={styles.cardBodyNoTopPadding}>
                <Text style={[styles.phoneSubtitle, { color: colors.textSecondary }]}>
                  {Copy.profile.phoneNumberDesc}
                </Text>
                <FloatingLabelInput
                  label={Copy.profile.phoneNumber}
                  value={profilePhone}
                  onChangeText={setProfilePhone}
                  onClear={() => setProfilePhone('')}
                  returnKeyType="done"
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  onBlur={handleSavePhone}
                  editable={!profilePhoneSaving}
                  style={{ marginBottom: spacing.xs }}
                />
                {profilePhoneSaving ? <Text style={[styles.phoneHint, { color: colors.textSecondary }]}>{Copy.common.saving}</Text> : null}
                <Divider />
                <SettingsRow
                  title={Copy.profile.changeEmail}
                  subtitle={Copy.profile.changeEmailDesc}
                  icon={<FontAwesome name="envelope-o" size={16} color={colors.textSecondary} />}
                  right={<Text style={[styles.settingLink, { color: colors.tint }]}>{showEmailForm ? Copy.common.close : Copy.profile.update}</Text>}
                  onPress={() => setShowEmailForm((prev) => !prev)}
                />
                {showEmailForm ? (
                  <View style={styles.accountInlineForm}>
                    <FloatingLabelInput
                      label={Copy.profile.newEmail}
                      value={newEmail}
                      onChangeText={setNewEmail}
                      onClear={() => setNewEmail('')}
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      returnKeyType="done"
                      editable={!accountSaving}
                      style={{ marginBottom: spacing.sm }}
                    />
                    <PrimaryButton onPress={handleUpdateEmail} disabled={accountSaving}>
                      {accountSaving ? Copy.common.saving : Copy.profile.update}
                    </PrimaryButton>
                  </View>
                ) : null}
                <Divider />
                <SettingsRow
                  title={Copy.profile.changePassword}
                  subtitle={Copy.profile.changePasswordDesc}
                  icon={<FontAwesome name="lock" size={16} color={colors.textSecondary} />}
                  right={<Text style={[styles.settingLink, { color: colors.tint }]}>{showPasswordForm ? Copy.common.close : Copy.profile.update}</Text>}
                  onPress={() => setShowPasswordForm((prev) => !prev)}
                />
                {showPasswordForm ? (
                  <View style={styles.accountInlineForm}>
                    <FloatingLabelInput
                      label={Copy.profile.newPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      onClear={() => setNewPassword('')}
                      autoCapitalize="none"
                      autoComplete="password-new"
                      secureTextEntry
                      returnKeyType="done"
                      editable={!accountSaving}
                      style={{ marginBottom: spacing.sm }}
                    />
                    <PrimaryButton onPress={handleUpdatePassword} disabled={accountSaving}>
                      {accountSaving ? Copy.common.saving : Copy.profile.update}
                    </PrimaryButton>
                  </View>
                ) : null}
                <Divider />
                <View style={styles.signOutWrap}>
                  <GhostButton
                    onPress={handleSignOut}
                    style={{ ...styles.signOutBtn, borderColor: colors.accentTomato }}
                    textStyle={{ color: colors.accentTomato }}
                  >
                    {Copy.common.signOut}
                  </GhostButton>
                </View>
              </CardBody>
            </Card>
          </>
        ) : (
          <Card style={styles.signInCard}>
            <CardBody>
              <View style={styles.signInContent}>
                <FontAwesome name="user-circle-o" size={48} color={colors.tintMuted} />
                <Text style={[styles.signInText, { color: colors.textSecondary }]}>
                  {Copy.profile.signInFullPrompt}
                </Text>
                <PrimaryButton onPress={() => router.push('/sign-in')}>
                  {Copy.common.signIn}
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
  avatarWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontSize: typography.h2,
    fontWeight: fontWeight.semibold,
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
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: typography.small,
    marginTop: spacing.xs / 2,
  },
  statSkeleton: {
    marginVertical: spacing.xs / 2,
  },
  statsErrorText: {
    fontSize: typography.small,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  statsErrorWrap: {
    alignItems: 'center',
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
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    borderWidth: 1,
  },
  badgeChipText: {
    fontSize: typography.small,
    fontWeight: fontWeight.semibold,
  },
  settingsCard: {
    marginBottom: spacing.xl,
  },
  cardBodyNoTopPadding: {
    paddingTop: 0,
  },
  settingLink: {
    fontSize: typography.caption,
    fontWeight: fontWeight.semibold,
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
    lineHeight: lineHeight.body,
  },
  phoneSubtitle: {
    fontSize: typography.small,
    marginBottom: spacing.sm,
    lineHeight: lineHeight.small,
  },
  phoneHint: {
    fontSize: typography.small,
    marginBottom: spacing.md,
  },
  accountInlineForm: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});

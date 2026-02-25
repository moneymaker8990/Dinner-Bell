import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Card, CardBody } from '@/components/Card';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { GradientHeader } from '@/components/GradientHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { fontWeight, lineHeight, radius, spacing, typography } from '@/constants/Theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { trackInviteOpened, trackRsvpSubmitted, trackShareInitiated, trackWaitlistJoined } from '@/lib/analytics';
import { hapticRsvp } from '@/lib/haptics';
import { addGuestByInvite, getInvitePreview, type EventByInvite, type InvitePreview } from '@/lib/invite';
import { notifyHostRsvpChange } from '@/lib/notifyHost';
import { supabase } from '@/lib/supabase';
import { buildInviteUrl } from '@/lib/urls';
import type { RsvpStatus } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Switch } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

function fullAddress(e: EventByInvite): string {
  const parts = [e.address_line1, e.address_line2, e.city, e.state, e.postal_code, e.country].filter(Boolean);
  return parts.join(', ');
}

type InviteRsvpLabelKey = 'rsvpGoing' | 'rsvpLate' | 'rsvpMaybe' | 'rsvpCant';
const RSVP_OPTIONS: { value: RsvpStatus; label: InviteRsvpLabelKey }[] = [
  { value: 'going', label: 'rsvpGoing' },
  { value: 'late', label: 'rsvpLate' },
  { value: 'maybe', label: 'rsvpMaybe' },
  { value: 'cant', label: 'rsvpCant' },
];
const RSVP_ACCENT_KEY: Record<RsvpStatus, keyof typeof Colors.light> = {
  going: 'rsvpGoing',
  late: 'rsvpLate',
  maybe: 'rsvpMaybe',
  cant: 'rsvpCant',
};
const RSVP_ICONS: Record<RsvpStatus, keyof typeof Ionicons.glyphMap> = {
  going: 'checkmark-circle-outline',
  late: 'time-outline',
  maybe: 'help-circle-outline',
  cant: 'close-circle-outline',
};

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = (useLocalSearchParams<{ token?: string }>().token as string) ?? '';
  const action = (useLocalSearchParams<{ action?: string }>().action as string) ?? '';
  const contactParam = (useLocalSearchParams<{ email?: string; phone?: string }>().email as string) ?? (useLocalSearchParams<{ email?: string; phone?: string }>().phone as string) ?? '';
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>('going');
  const [wantsReminders, setWantsReminders] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const oneTapDone = useRef(false);
  const reduceMotion = useReducedMotion();

  const loadInvitePreview = useCallback(async () => {
    if (!id || !token) {
      setError(Copy.invite.invalidInviteLink);
      setLoading(false);
      return;
    }
    setLoading(true);
    const p = await getInvitePreview(id, token);
    setPreview(p ?? null);
    setError(p ? null : Copy.invite.inviteInvalidOrExpired);
    setLoading(false);
    if (p) trackInviteOpened(id, 'direct_link');
  }, [id, token]);

  const event = preview?.event ?? null;
  const capacity = (event as EventByInvite & { capacity?: number | null })?.capacity;
  const guestCount = preview?.guest_count ?? 0;
  const isEventFull = capacity != null && guestCount >= capacity;

  useEffect(() => {
    loadInvitePreview();
  }, [loadInvitePreview]);

  useEffect(() => {
    if (contactParam) setGuestContact(contactParam);
    if (action === 'rsvp_going') setRsvpStatus('going');
    else if (action === 'rsvp_late') setRsvpStatus('late');
    else if (action === 'rsvp_cant') setRsvpStatus('cant');
  }, [action, contactParam]);

  useEffect(() => {
    if (oneTapDone.current || !preview?.event || !id || !token || !action || !contactParam.trim()) return;
    const status: RsvpStatus | null = action === 'rsvp_going' ? 'going' : action === 'rsvp_late' ? 'late' : action === 'rsvp_cant' ? 'cant' : null;
    if (!status) return;
    oneTapDone.current = true;
    hapticRsvp();
    setSubmitting(true);
    setActionError(null);
    addGuestByInvite(id, token, 'Guest', contactParam.trim(), status, true).then((result) => {
      setGuestId(result.data ?? null);
      setSubmitting(false);
      if (result.data) {
        notifyHostRsvpChange(id, 'Guest').catch(() => {});
        router.replace(`/event/${id}?guestId=${result.data}`);
      } else {
        setActionError(result.error ?? Copy.invite.unableToSubmitRsvp);
      }
    });
  }, [preview?.event, id, token, action, contactParam, router]);

  const handleRsvp = async () => {
    if (!event || !guestName.trim() || !guestContact.trim()) return;
    hapticRsvp();
    setSubmitting(true);
    setActionError(null);
    const result = await addGuestByInvite(id!, token, guestName.trim(), guestContact.trim(), rsvpStatus, wantsReminders);
    setGuestId(result.data ?? null);
    setSubmitting(false);
    if (result.data) {
      trackRsvpSubmitted(id!, rsvpStatus, 'guest');
      notifyHostRsvpChange(id!, guestName.trim()).catch(() => {});
      if (rsvpStatus === 'going') {
        setShowCelebration(true);
        setTimeout(() => router.push(`/event/${id}?guestId=${result.data}`), 2200);
      } else {
        router.push(`/event/${id}?guestId=${result.data}`);
      }
    } else {
      setActionError(result.error ?? Copy.invite.unableToSubmitRsvp);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    trackShareInitiated(id!, 'invite_page');
    const url = buildInviteUrl(id!, token);
    await Share.share({ message: Copy.event.inviteShareMessage(event.title, url), url });
  };

  const handleJoinWaitlist = async () => {
    if (!id || !event || !guestName.trim() || !guestContact.trim()) return;
    setWaitlistSubmitting(true);
    setActionError(null);
    const contactType = guestContact.includes('@') ? 'email' : 'phone';
    const { error } = await supabase.from('event_waitlist').insert({
      event_id: id,
      contact_type: contactType,
      contact_value: guestContact.trim(),
      display_name: guestName.trim() || null,
    });
    setWaitlistSubmitting(false);
    if (!error) {
      trackWaitlistJoined(id);
      setWaitlistJoined(true);
    } else {
      setActionError(Copy.invite.unableToJoinWaitlist);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <SkeletonLoader width="80%" height={24} style={{ marginBottom: spacing.md }} />
        <SkeletonLoader width="60%" height={20} />
        <SkeletonLoader width="90%" height={80} style={{ marginTop: spacing.xl }} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{Copy.invite.loadingInvite}</Text>
      </View>
    );
  }
  if (error || !event) {
    return (
      <View style={[styles.container, styles.centered, { padding: spacing.xl }]}>
        <Card style={{ width: '100%', maxWidth: 560 }}>
          <CardBody>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
              <Text style={[styles.errorTitle, { color: colors.textPrimary }]} accessibilityRole="header">{Copy.invite.invalidInvite}</Text>
              <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{Copy.invite.checkLink}</Text>
              <AnimatedPressable
                variant="primary"
                enableHaptics
                style={[styles.button, { backgroundColor: colors.primaryButton }]}
                onPress={loadInvitePreview}
                accessibilityRole="button"
                accessibilityLabel="Try loading invite again"
              >
                <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{Copy.common.tryAgain}</Text>
              </AnimatedPressable>
            </View>
          </CardBody>
        </Card>
      </View>
    );
  }

  const menuSectionsList = (preview?.menu_sections ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((sec) => ({
      title: sec.title,
      items: (preview?.menu_items ?? []).filter((mi) => mi.section_id === sec.id).sort((a, b) => a.sort_order - b.sort_order),
    }));

  const bringHighlights = (preview?.bring_items ?? []).slice(0, 4).map((b) => b.name).join(', ');
  const oneTapRsvp = async (status: RsvpStatus) => {
    const name = guestName.trim() || 'Guest';
    const contact = guestContact.trim() || contactParam;
    if (!contact || !event) return;
    hapticRsvp();
    setSubmitting(true);
    setActionError(null);
    const result = await addGuestByInvite(id!, token, name, contact, status, wantsReminders);
    setGuestId(result.data ?? null);
    setSubmitting(false);
    if (result.data) {
      notifyHostRsvpChange(id!, name).catch(() => {});
      if (status === 'going') {
        setShowCelebration(true);
        setTimeout(() => router.push(`/event/${id}?guestId=${result.data}`), 2200);
      } else {
        router.push(`/event/${id}?guestId=${result.data}`);
      }
    } else {
      setActionError(result.error ?? 'Unable to submit RSVP right now.');
    }
  };

  const enterAnimation = (index: number) =>
    reduceMotion ? undefined : FadeInDown.delay(index * 100).duration(400);

  return (
    <View style={styles.container}>
      <GradientHeader
        title={Copy.invite.title}
        subtitle={event.title}
        height={200}
        onBack={() => router.canGoBack() && router.back()}
        coverImageUrl={event?.cover_image_url}
      />
      <KeyboardAwareScrollView style={styles.scrollBody} contentContainerStyle={styles.content}>
      <Animated.View entering={enterAnimation(0)} style={[styles.richCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {preview?.host_name ? (
          <Text style={[styles.hostBy, { color: colors.textSecondary }]}>{Copy.event.hostedBy(preview.host_name)}</Text>
        ) : null}
        <Animated.View entering={enterAnimation(1)} style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.tint} style={styles.infoIcon} />
          <Text style={styles.date}>{new Date(event.start_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
        </Animated.View>
        <Animated.View entering={enterAnimation(2)} style={styles.infoRow}>
          <Ionicons name="location-outline" size={18} color={colors.tint} style={styles.infoIcon} />
          <Text style={styles.body}>{fullAddress(event)}</Text>
        </Animated.View>
        {event.location_notes ? <Text style={styles.notes}>{event.location_notes}</Text> : null}
        {(preview?.bring_items?.length ?? 0) > 0 && (
          <Animated.View entering={enterAnimation(3)}>
            <Text style={styles.bringHighlights}>Bring: {bringHighlights || (preview!.bring_items.length > 1 ? `${preview!.bring_items.length} items` : preview!.bring_items[0].name)}</Text>
          </Animated.View>
        )}
      </Animated.View>

      {(menuSectionsList.length > 0 || (preview?.bring_items?.length ?? 0) > 0) && (
        <Animated.View entering={enterAnimation(4)} style={styles.previewSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]} accessibilityRole="header">{Copy.invite.whatToExpect}</Text>
      {menuSectionsList.length > 0 && (
        <>
          <Text style={[styles.subsectionTitle, { color: colors.textSecondary }]}>{Copy.common.menu}</Text>
          {menuSectionsList.map((sec, idx) => (
            <View key={idx}>
              <Text style={styles.subsectionTitle}>{sec.title}</Text>
              {sec.items.map((item) => (
                <View key={item.id} style={styles.menuItemRow}>
                  <Text style={styles.body}>• {item.name}</Text>
                  {item.dietary_tags && item.dietary_tags.length > 0 && (
                    <View style={styles.dietaryRow}>
                      {item.dietary_tags.map((tag) => (
                        <View
                          key={tag}
                          style={[styles.dietaryChip, { backgroundColor: colors.accentSageFaint, borderColor: colors.accentSageBorder }]}>
                          <Text style={[styles.dietaryChipText, { color: colors.accentSage }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
        </>
      )}
      {(preview?.bring_items?.length ?? 0) > 0 && (
        <>
          <Text style={[styles.subsectionTitle, { color: colors.textSecondary }]}>{Copy.common.bringList}</Text>
          {preview!.bring_items.map((item) => (
            <Text key={item.id} style={[styles.body, { color: colors.textSecondary }]}>• {item.name} ({item.quantity})</Text>
          ))}
        </>
      )}
        </Animated.View>
      )}
      {guestCount > 0 && (
        <Animated.View entering={enterAnimation(5)}>
          <Text style={[styles.whoGoing, { color: colors.textSecondary }]}>{Copy.invite.whoIsGoing(guestCount)}</Text>
        </Animated.View>
      )}

      {!guestId ? (
        <>
          {actionError ? (
            <Text style={[styles.inlineError, { color: colors.error }]}>{actionError}</Text>
          ) : null}
          {isEventFull ? (
            <>
              <Text style={[styles.eventFull, { color: colors.text }]} accessibilityRole="header">{Copy.invite.eventFull}</Text>
              {waitlistJoined ? (
                <Text style={styles.waitlistDone}>{Copy.invite.onWaitlist}</Text>
              ) : (
                <>
                  <Text style={styles.sectionTitle} accessibilityRole="header">{Copy.invite.joinWaitlist}</Text>
                  <FloatingLabelInput
                    label={Copy.placeholder.yourName}
                    value={guestName}
                    onChangeText={setGuestName}
                    onClear={() => setGuestName('')}
                    returnKeyType="next"
                    autoComplete="name"
                    autoCapitalize="words"
                    style={{ marginBottom: spacing.md }}
                  />
                  <FloatingLabelInput
                    label={Copy.placeholder.phoneOrEmail}
                    value={guestContact}
                    onChangeText={setGuestContact}
                    onClear={() => setGuestContact('')}
                    returnKeyType="done"
                    autoComplete="email"
                    autoCapitalize="none"
                    style={{ marginBottom: spacing.md }}
                  />
                  <AnimatedPressable
                    variant="primary"
                    enableHaptics
                    style={[styles.button, { backgroundColor: colors.primaryButton }, waitlistSubmitting && styles.buttonDisabled]}
                    onPress={handleJoinWaitlist}
                    disabled={waitlistSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Join the waitlist"
                  >
                    <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{waitlistSubmitting ? Copy.invite.joining : Copy.invite.joinWaitlist}</Text>
                  </AnimatedPressable>
                </>
              )}
            </>
          ) : (
            <>
          <Text style={styles.sectionTitle} accessibilityRole="header">{Copy.invite.rsvp}</Text>
          <FloatingLabelInput
            label={Copy.placeholder.yourName}
            value={guestName}
            onChangeText={setGuestName}
            onClear={() => setGuestName('')}
            returnKeyType="next"
            autoComplete="name"
            autoCapitalize="words"
            style={{ marginBottom: spacing.md }}
          />
          <FloatingLabelInput
            label={Copy.placeholder.phoneOrEmail}
            value={guestContact}
            onChangeText={setGuestContact}
            onClear={() => setGuestContact('')}
            returnKeyType="done"
            autoComplete="email"
            autoCapitalize="none"
            style={{ marginBottom: spacing.md }}
          />
          <View style={styles.rsvpRow}>
            {RSVP_OPTIONS.map(({ value, label }) => {
              const accent = (colors as any)[RSVP_ACCENT_KEY[value]] as string;
              const isSelected = rsvpStatus === value;
              return (
                <AnimatedPressable
                  key={value}
                  pressScale={0.94}
                  style={[
                    styles.rsvpBtn,
                    { borderColor: colors.border },
                    isSelected && { backgroundColor: accent, borderColor: accent },
                  ]}
                  onPress={() => {
                    hapticRsvp();
                    setRsvpStatus(value);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={Copy.invite[label]}
                >
                  <Ionicons
                    name={RSVP_ICONS[value]}
                    size={20}
                    color={isSelected ? colors.primaryButtonText : colors.textPrimary}
                    style={styles.rsvpBtnIcon}
                  />
                  <Text style={[styles.rsvpBtnText, { color: colors.textPrimary }, isSelected && { color: colors.primaryButtonText }]}>
                    {Copy.invite[label]}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
          {(rsvpStatus === 'going' || rsvpStatus === 'maybe' || rsvpStatus === 'late') && (
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{Copy.profile.sendReminders}</Text>
              <Switch value={wantsReminders} onValueChange={setWantsReminders} accessibilityRole="switch" accessibilityLabel={Copy.profile.sendReminders} />
            </View>
          )}
          <AnimatedPressable
            variant="primary"
            enableHaptics
            pressScale={0.95}
            style={[styles.button, { backgroundColor: colors.primaryButton }, submitting && styles.buttonDisabled]}
            onPress={handleRsvp}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Submit your RSVP"
          >
            <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{submitting ? Copy.common.saving : Copy.invite.submitRsvp}</Text>
          </AnimatedPressable>
            </>
          )}
        </>
      ) : (
        <AnimatedPressable variant="primary" enableHaptics pressScale={0.95} style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={() => router.push(`/event/${id}`)} accessibilityRole="button" accessibilityLabel="View event details">
          <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{Copy.invite.viewEvent}</Text>
        </AnimatedPressable>
      )}

      <AnimatedPressable pressScale={0.96} style={styles.buttonSecondary} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share invite link">
        <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>{Copy.invite.shareCta}</Text>
      </AnimatedPressable>
    </KeyboardAwareScrollView>

      <CelebrationOverlay
        visible={showCelebration}
        headline="You're in!"
        subtitle="See you at dinner!"
        onFinish={() => setShowCelebration(false)}
        displayDuration={2000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollBody: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  infoIcon: { marginRight: spacing.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl + spacing.xl + spacing.xs },
  loadingText: { fontSize: typography.meta, marginTop: spacing.lg },
  errorTitle: { fontSize: typography.headline, fontWeight: '600', textAlign: 'center', marginBottom: spacing.sm },
  errorBody: { fontSize: typography.body, textAlign: 'center', lineHeight: lineHeight.meta },
  richCard: { padding: spacing.lg, borderRadius: radius.card, borderWidth: 1, marginBottom: spacing.xl },
  title: { fontSize: typography.title, fontWeight: fontWeight.bold, marginBottom: spacing.xs },
  hostBy: { fontSize: typography.meta, marginBottom: spacing.sm },
  date: { fontSize: typography.body, marginBottom: spacing.sm },
  body: { fontSize: typography.meta, marginBottom: spacing.xs },
  notes: { fontSize: typography.meta, opacity: 0.8, marginTop: spacing.xs, marginBottom: spacing.xs },
  bringHighlights: { fontSize: typography.microLabel, opacity: 0.9, marginTop: spacing.sm },
  whoGoing: { fontSize: typography.meta, fontWeight: '500', marginBottom: spacing.lg, textAlign: 'center' },
  inlineError: { fontSize: typography.meta, marginBottom: spacing.md },
  previewSection: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: typography.headline, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm },
  subsectionTitle: { fontSize: typography.body, fontWeight: '500', marginTop: spacing.sm, marginBottom: spacing.xs },
  menuItemRow: { marginBottom: spacing.xs + 2 },
  dietaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginTop: spacing.xs, marginLeft: spacing.lg },
  dietaryChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: spacing.xs + 2, borderWidth: 1 },
  dietaryChipText: { fontSize: typography.microLabel, fontWeight: '500' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  toggleLabel: { fontSize: typography.meta },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    padding: spacing.md,
    fontSize: typography.body,
    marginBottom: spacing.md,
  },
  rsvpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  rsvpBtn: { flex: 1, minWidth: '45%' as unknown as number, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  rsvpBtnIcon: { marginBottom: spacing.xs },
  rsvpBtnText: { fontWeight: fontWeight.semibold, fontSize: typography.meta },
  eventFull: { fontSize: typography.headline, fontWeight: '600', marginBottom: spacing.md, textAlign: 'center' },
  waitlistDone: { fontSize: typography.meta, opacity: 0.9, marginBottom: spacing.lg, textAlign: 'center' },
  button: { padding: spacing.lg, borderRadius: radius.input, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { fontWeight: fontWeight.semibold, fontSize: typography.body },
  buttonDisabled: { opacity: 0.6 },
  buttonSecondary: { padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
  buttonSecondaryText: { fontWeight: '600' },
});

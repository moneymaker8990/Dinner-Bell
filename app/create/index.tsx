import { AnimatedPressable } from '@/components/AnimatedPressable';
import { AppBottomSheet } from '@/components/AppBottomSheet';
import { Card, CardBody } from '@/components/Card';
import { PrimaryButton } from '@/components/Buttons';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { ProgressBar } from '@/components/ProgressBar';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { lineHeight, radius, spacing, typography } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { trackCreateFailed, trackCreatePublished, trackCreateStart, trackCreateStepCompleted, trackScreenViewed } from '@/lib/analytics';
import { defaultForm, generateId, type CreateEventForm } from '@/lib/eventForm';
import { fetchGroups, getGroupMembers, type GuestGroup } from '@/lib/groups';
import { hapticSuccess } from '@/lib/haptics';
import { addGuestByHost, addGuestByHostPhone, sendInviteEmail, sendInvitePush, sendInvitePushByPhone, sendInviteSms } from '@/lib/invite';
import { queryClient } from '@/lib/queryClient';
import { supabase, supabaseUrl } from '@/lib/supabase';
import { fetchTemplates, THEME_ACCENT, type EventTemplate } from '@/lib/templates';
import { useContactsPicker } from '@/lib/useContactsPicker';
import type { BringItemCategory } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import Animated, { FadeInDown, FadeInRight, FadeOutLeft } from 'react-native-reanimated';

const STEPS = [
  Copy.create.stepBasics,
  Copy.create.stepLocation,
  Copy.create.stepMenu,
  Copy.create.stepBringList,
  Copy.create.stepInvite,
  Copy.create.stepReview,
] as const;
const TOTAL_STEPS = 6;
const BRING_CATEGORIES: BringItemCategory[] = ['drink', 'side', 'dessert', 'supplies', 'other'];
const DRAFT_KEY = 'dinner_bell_create_draft';
const INVITE_NOTE_TEMPLATES = [
  Copy.create.inviteNoteTemplateFriendly,
  Copy.create.inviteNoteTemplatePotluck,
  Copy.create.inviteNoteTemplateTiming,
] as const;

function fullAddressFromForm(form: CreateEventForm): string {
  const parts = [form.addressLine1, form.addressLine2, form.city, form.state, form.postalCode, form.country].filter(Boolean);
  return parts.join(', ');
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 24; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

function formatBellTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type ContactRowProps = {
  item: { id: string; name: string; value: string; type: 'phone' | 'email' };
  isSelected: boolean;
  onToggle: (id: string) => void;
  inputBorderColor: string;
  borderColor: string;
  tintColor: string;
};

const ContactRow = React.memo(function ContactRow({
  item,
  isSelected,
  onToggle,
  inputBorderColor,
  borderColor,
  tintColor,
}: ContactRowProps) {
  return (
    <Pressable
      style={[styles.contactRow, { borderColor: inputBorderColor }]}
      onPress={() => onToggle(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`${isSelected ? 'Deselect' : 'Select'} ${item.name} for invite`}>
      <Text style={styles.contactRowName}>{item.name}</Text>
      <Text style={styles.contactRowPhone}>{item.value}</Text>
      <View style={[styles.checkbox, { borderColor: borderColor }, isSelected && { backgroundColor: tintColor }]} />
    </Pressable>
  );
});

export default function CreateDinnerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ duplicateEventId?: string }>();
  const duplicateEventId = params.duplicateEventId;
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateEventForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showBellPicker, setShowBellPicker] = useState(false);
  const [groups, setGroups] = useState<GuestGroup[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const hasNavigatedRef = useRef(false);
  const contactsSheetRef = useRef<GorhomBottomSheet>(null);
  const contactsPicker = useContactsPicker();
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [savedDraft, setSavedDraft] = useState<any>(null);
  const [draftSavedLabel, setDraftSavedLabel] = useState(false);

  useEffect(() => {
    trackScreenViewed('CreateEvent');
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchGroups().then(setGroups);
  }, [user?.id]);

  useEffect(() => {
    fetchTemplates().then(setTemplates);
    trackCreateStart();
  }, []);

  useEffect(() => {
    if (!duplicateEventId || !user) return;
    const load = async () => {
      const { data: e, error: eErr } = await supabase.from('events').select('*').eq('id', duplicateEventId).single();
      if (eErr || !e) return;
      const [{ data: sections }, { data: items }, { data: bring }, { data: blocks }, { data: guestList }] = await Promise.all([
        supabase.from('menu_sections').select('*').eq('event_id', duplicateEventId).order('sort_order'),
        supabase.from('menu_items').select('*').eq('event_id', duplicateEventId).order('sort_order'),
        supabase.from('bring_items').select('*').eq('event_id', duplicateEventId).order('sort_order'),
        supabase.from('schedule_blocks').select('*').eq('event_id', duplicateEventId).order('sort_order'),
        supabase.from('event_guests').select('guest_phone_or_email').eq('event_id', duplicateEventId),
      ]);
      const sectionMap = new Map<string, string>();
      (sections ?? []).forEach((s: { id: string }) => sectionMap.set(s.id, generateId()));
      const menuSections = (sections ?? []).map((s: { id: string; title: string; sort_order: number }, i: number) => ({
        id: sectionMap.get(s.id) ?? generateId(),
        title: s.title,
        items: (items ?? [])
          .filter((it: { section_id: string }) => it.section_id === s.id)
          .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
          .map((it: { name: string; notes: string | null; dietary_tags: string[] | null }) => ({
            id: generateId(),
            name: it.name,
            notes: it.notes ?? '',
            dietaryTags: it.dietary_tags ?? [],
          })),
      }));
      const bringItems = (bring ?? []).map((b: { name: string; quantity: string; category: string; is_required: boolean; is_claimable: boolean; notes: string | null }) => ({
        id: generateId(),
        name: b.name,
        quantity: b.quantity ?? '1',
        category: b.category as BringItemCategory,
        isRequired: b.is_required,
        isClaimable: b.is_claimable,
        notes: b.notes ?? '',
      }));
      const scheduleBlocks = (blocks ?? []).map((b: { title: string; time: string | null; notes: string | null }) => ({
        id: generateId(),
        title: b.title,
        time: b.time ? b.time.slice(0, 16) : '',
        notes: b.notes ?? '',
      }));
      const guestEmails = (guestList ?? []).map((g: { guest_phone_or_email: string }) => g.guest_phone_or_email).filter((x: string) => x.includes('@'));
      const base = new Date();
      const startTime = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      const bellTime = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString().slice(0, 16);
      setForm({
        ...defaultForm,
        title: (e.title ?? '') + ' (copy)',
        description: e.description ?? '',
        startTime,
        bellTime,
        bellSound: (e.bell_sound as CreateEventForm['bellSound']) ?? 'chime',
        endTime: '',
        timezone: e.timezone ?? defaultForm.timezone,
        addressLine1: e.address_line1 ?? '',
        addressLine2: e.address_line2 ?? '',
        city: e.city ?? '',
        state: e.state ?? '',
        postalCode: e.postal_code ?? '',
        country: e.country ?? '',
        locationName: e.location_name ?? '',
        locationNotes: e.location_notes ?? '',
        menuSections,
        bringItems,
        scheduleBlocks,
        guestEmails,
        noteToGuests: '',
      });
    };
    load();
  }, [duplicateEventId, user?.id]);

  // ── Draft helpers ──────────────────────────────────────────────────
  const saveDraft = useCallback(async (formState: CreateEventForm, currentStep: number) => {
    try {
      const payload = JSON.stringify({ form: formState, step: currentStep });
      await AsyncStorage.setItem(DRAFT_KEY, payload);
      setDraftSavedLabel(true);
      setTimeout(() => setDraftSavedLabel(false), 1500);
    } catch {
      // Silently ignore storage errors
    }
  }, []);

  const loadDraft = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as { form: CreateEventForm; step: number };
    } catch {
      return null;
    }
  }, []);

  const clearDraft = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
    } catch {
      // Silently ignore
    }
  }, []);

  // Restore draft on mount
  useEffect(() => {
    if (duplicateEventId) return; // Skip draft restore when duplicating
    loadDraft().then((draft) => {
      if (draft) {
        setSavedDraft(draft);
        setShowDraftPrompt(true);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft when step or key form fields change
  useEffect(() => {
    // Don't auto-save while the draft prompt is showing or after event creation
    if (showDraftPrompt || createdEventId) return;
    // Only save if the form has meaningful content
    if (!form.title && step === 0) return;
    saveDraft(form, step);
  }, [step, form.title, form.startTime, form.bellTime, form.addressLine1, form.city, form.menuSections.length, form.bringItems.length, form.guestEmails.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear draft on successful creation
  useEffect(() => {
    if (createdEventId) {
      clearDraft();
    }
  }, [createdEventId, clearDraft]);

  const updateForm = useCallback((updates: Partial<CreateEventForm>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      trackCreateStepCompleted(step, STEPS[step]);
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const applyTemplate = useCallback((t: EventTemplate) => {
    const base = new Date();
    const start = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
    const durationMin = t.default_duration_min ?? 120;
    const bellOffsetMin = t.default_bell_offset_min ?? 0;
    const bell = new Date(start.getTime() + bellOffsetMin * 60 * 1000);
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    const menuRaw = (t.menu_json as { title: string; items: { name: string; notes?: string; dietaryTags?: string[] }[] }[]) ?? [];
    const menuSections = menuRaw.map((sec) => ({
      id: generateId(),
      title: sec.title ?? 'Section',
      items: (sec.items ?? []).map((it) => ({
        id: generateId(),
        name: it.name ?? '',
        notes: it.notes ?? '',
        dietaryTags: it.dietaryTags ?? [],
      })),
    }));
    const bringRaw = (t.bring_json as { name: string; quantity?: string; category: BringItemCategory; isRequired?: boolean; isClaimable?: boolean; notes?: string }[]) ?? [];
    const bringItems = bringRaw.map((b) => ({
      id: generateId(),
      name: b.name ?? '',
      quantity: b.quantity ?? '1',
      category: (b.category as BringItemCategory) ?? 'other',
      isRequired: b.isRequired ?? false,
      isClaimable: b.isClaimable ?? true,
      notes: b.notes ?? '',
    }));
    const accentColor = t.theme_slug ? (THEME_ACCENT[t.theme_slug] ?? null) : null;
    setForm((prev) => ({
      ...prev,
      title: t.name,
      description: t.description ?? prev.description,
      startTime: start.toISOString().slice(0, 16),
      bellTime: bell.toISOString().slice(0, 16),
      endTime: end.toISOString().slice(0, 16),
      menuSections: menuSections.length ? menuSections : prev.menuSections,
      bringItems: bringItems.length ? bringItems : prev.bringItems,
      scheduleBlocks: prev.scheduleBlocks,
      templateSlug: t.slug,
      accentColor: accentColor ?? prev.accentColor ?? null,
    }));
  }, []);

  const pickerBtnStyle = [styles.pickerBtn, { backgroundColor: colors.card }];

  const pickCoverImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setForm({ ...form, coverImageUri: result.assets[0].uri });
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.stepTitle} accessibilityRole="header">{Copy.auth.signInToCreate}</Text>
        <Pressable
          style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }]}
          onPress={() => router.push('/sign-in')}
          accessibilityRole="button"
          accessibilityLabel={Copy.auth.signInToCreateEvents}>
          <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    // Validate required fields
    if (!form.title.trim()) {
      setError('Please enter a title for your event.');
      setSaving(false);
      return;
    }
    const now = new Date();
    const bellDate = new Date(form.bellTime);
    const startDate = new Date(form.startTime);
    if (isNaN(bellDate.getTime()) || isNaN(startDate.getTime())) {
      setError('Please set valid start and bell times.');
      setSaving(false);
      return;
    }
    if (bellDate <= now) {
      setError('Bell time must be in the future.');
      setSaving(false);
      return;
    }
    if (bellDate < startDate) {
      setError('Bell time cannot be before the start time.');
      setSaving(false);
      return;
    }

    try {
      if (supabaseUrl.includes('placeholder')) {
        setError('Supabase not configured for this build. In Vercel: Settings → Environment Variables → add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from your Supabase project, then redeploy.');
        setSaving(false);
        return;
      }
      const inviteToken = generateToken();
      const { data: eventId, error: eventError } = await supabase.rpc('create_event', {
        p_title: form.title,
        p_description: form.description || null,
        p_start_time: form.startTime,
        p_bell_time: form.bellTime,
        p_bell_sound: form.bellSound || 'chime',
        p_end_time: form.endTime || null,
        p_timezone: form.timezone,
        p_address_line1: form.addressLine1 || 'TBD',
        p_address_line2: form.addressLine2 || null,
        p_city: form.city || '',
        p_state: form.state || '',
        p_postal_code: form.postalCode || '',
        p_country: form.country || '',
        p_location_name: form.locationName || null,
        p_location_notes: form.locationNotes || null,
        p_invite_note: form.noteToGuests || null,
        p_invite_token: inviteToken,
        p_theme_slug: form.templateSlug ?? null,
        p_accent_color: form.accentColor ?? null,
        p_capacity: form.capacity ?? null,
        p_is_public: form.isPublic ?? false,
      });

      if (eventError || eventId == null) {
        if (__DEV__) {
          console.error('create_event failed', {
            code: eventError?.code,
            message: eventError?.message,
            details: eventError?.details,
          });
        }
        // Show which Supabase host we're using so you can verify env vars (e.g. on Vercel)
        const hostHint = supabaseUrl.includes('placeholder')
          ? ' (config: placeholder — set EXPO_PUBLIC_SUPABASE_URL in Vercel and redeploy)'
          : ` (API: ${supabaseUrl.replace(/^https?:\/\//, '').split('/')[0]})`;
        const msg =
          eventError?.code === 'PGRST116'
            ? `Event service not configured. Run the latest Supabase migrations.${hostHint}`
            : eventError?.code === '404' || eventError?.message?.includes('404')
              ? `Supabase returned 404 — check EXPO_PUBLIC_SUPABASE_URL matches your project.${hostHint}`
              : `Something went wrong creating your event. ${eventError?.message ?? ''}${hostHint}`;
        setError(msg.trim());
        setSaving(false);
        return;
      }

      for (let i = 0; i < form.menuSections.length; i++) {
        const sec = form.menuSections[i];
        const { data: sectionData, error: sectionError } = await supabase
          .from('menu_sections')
          .insert({ event_id: eventId, title: sec.title, sort_order: i })
          .select('id')
          .single();
        if (sectionError || !sectionData) continue;
        const sectionId = (sectionData as { id: string }).id;
        for (let j = 0; j < sec.items.length; j++) {
          await supabase.from('menu_items').insert({
            event_id: eventId,
            section_id: sectionId,
            name: sec.items[j].name,
            notes: sec.items[j].notes || null,
            dietary_tags: sec.items[j].dietaryTags?.length ? sec.items[j].dietaryTags : null,
            sort_order: j,
          });
        }
      }

      for (let i = 0; i < form.bringItems.length; i++) {
        const item = form.bringItems[i];
        await supabase.from('bring_items').insert({
          event_id: eventId,
          name: item.name,
          quantity: item.quantity || '1',
          category: item.category,
          is_required: item.isRequired,
          is_claimable: item.isClaimable,
          status: 'unclaimed',
          notes: item.notes || null,
          sort_order: i,
        });
      }

      for (let i = 0; i < form.scheduleBlocks.length; i++) {
        const block = form.scheduleBlocks[i];
        await supabase.from('schedule_blocks').insert({
          event_id: eventId,
          title: block.title,
          time: block.time || null,
          notes: block.notes || null,
          sort_order: i,
        });
      }

      const bellTime = new Date(form.bellTime);
      const reminder30 = new Date(bellTime.getTime() - 30 * 60 * 1000);
      const reminder2h = new Date(bellTime.getTime() - 2 * 60 * 60 * 1000);
      await supabase.from('notification_schedules').insert([
        { event_id: eventId, scheduled_at: reminder2h.toISOString(), type: 'reminder_2h' },
        { event_id: eventId, scheduled_at: reminder30.toISOString(), type: 'reminder_30m' },
        { event_id: eventId, scheduled_at: form.bellTime, type: 'bell' },
      ]);

      // Upload cover image if one was selected
      if (form.coverImageUri) {
        try {
          const response = await fetch(form.coverImageUri);
          const blob = await response.blob();
          await supabase.storage
            .from('event-covers')
            .upload(`${eventId}/cover.jpg`, blob, { contentType: 'image/jpeg', upsert: true });
          const { data: publicUrlData } = supabase.storage
            .from('event-covers')
            .getPublicUrl(`${eventId}/cover.jpg`);
          if (publicUrlData?.publicUrl) {
            await supabase.from('events').update({ cover_image_url: publicUrlData.publicUrl }).eq('id', eventId);
          }
        } catch (uploadErr) {
          if (__DEV__) console.warn('Cover image upload failed, skipping:', uploadErr);
        }
      }

      let inviteFailures = 0;
      let deliveryFailures = 0;
      for (const contact of form.guestEmails) {
        const trimmed = contact.trim();
        if (!trimmed) continue;
        if (trimmed.includes('@')) {
          const result = await addGuestByHost(eventId, trimmed);
          if (!result.data) {
            inviteFailures += 1;
          } else {
            const emailSent = await sendInviteEmail(eventId, trimmed);
            if (!emailSent) deliveryFailures += 1;
            await sendInvitePush(eventId, trimmed);
          }
        } else {
          const result = await addGuestByHostPhone(eventId, trimmed);
          if (!result.data) {
            inviteFailures += 1;
          } else {
            const smsSent = await sendInviteSms(eventId, trimmed);
            if (!smsSent) deliveryFailures += 1;
            await sendInvitePushByPhone(eventId, trimmed);
          }
        }
      }

      if (inviteFailures > 0) {
        setError(`${inviteFailures} invite${inviteFailures === 1 ? '' : 's'} could not be sent. You can retry from the event details page.`);
      } else if (deliveryFailures > 0) {
        setError(Copy.validation.inviteDeliveryFailed(deliveryFailures));
      }

      hapticSuccess();
      trackCreatePublished(eventId);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        setCreatedEventId(eventId);
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : Copy.validation.genericError;
      setError(errMsg);
      trackCreateFailed(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSelectedContactsToGuests = () => {
    if (contactsPicker.selectedIds.size === 0) return;
    const contacts = contactsPicker.contactsList
      .filter((c) => contactsPicker.selectedIds.has(c.id))
      .map((c) => c.value);
    const combined = [...new Set([...form.guestEmails, ...contacts])];
    updateForm({ guestEmails: combined });
    contactsPicker.setModalVisible(false);
    contactsPicker.setSelectedIds(new Set());
    contactsSheetRef.current?.close();
  };

  if (createdEventId != null) {
    return (
      <View style={[styles.container, styles.successWrap, { backgroundColor: colors.background }]}>
        <CelebrationOverlay visible={true} headline="You're all set!" subtitle="Your dinner is created." onFinish={() => {}} />
        <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.successHeadline, { color: colors.textPrimary }]} accessibilityRole="header">{Copy.create.publishSuccessHeadline}</Text>
          <Text style={[styles.successBody, { color: colors.textSecondary }]}>{Copy.create.publishSuccessBody}</Text>
          <PrimaryButton
            style={styles.successCta}
            onPress={() => router.replace(`/event/${createdEventId}` as any)}>
            {Copy.create.inviteNowCta}
          </PrimaryButton>
          <AnimatedPressable
            style={styles.successSecondary}
            onPress={() => router.replace(`/event/${createdEventId}` as any)}
            accessibilityRole="button"
            accessibilityLabel="View created event">
            <Text style={[styles.successSecondaryText, { color: colors.primaryBrand }]}>{Copy.create.viewEventCta}</Text>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Draft prompt overlay */}
      {showDraftPrompt && savedDraft && (
        <View style={[styles.draftPromptOverlay, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.draftPromptTitle, { color: colors.textPrimary }]}>Resume your draft?</Text>
          <Text style={[styles.draftPromptBody, { color: colors.textSecondary }]}>
            You have an unsaved draft for "{savedDraft.form?.title || 'Untitled event'}".
          </Text>
          <View style={styles.draftPromptActions}>
            <AnimatedPressable
              style={[styles.draftPromptBtn, { borderColor: colors.inputBorder }]}
              onPress={() => {
                clearDraft();
                setSavedDraft(null);
                setShowDraftPrompt(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Start fresh">
              <Text style={[styles.draftPromptBtnText, { color: colors.text }]}>Start fresh</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.draftPromptBtn, { backgroundColor: colors.primaryButton }]}
              onPress={() => {
                if (savedDraft.form) setForm(savedDraft.form);
                if (typeof savedDraft.step === 'number') setStep(savedDraft.step);
                setSavedDraft(null);
                setShowDraftPrompt(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Resume draft">
              <Text style={[styles.draftPromptBtnText, { color: colors.primaryButtonText }]}>Resume</Text>
            </AnimatedPressable>
          </View>
        </View>
      )}

      {/* Step progress bar */}
      <ProgressBar progress={step / (TOTAL_STEPS - 1)} label={`Step ${step + 1} of ${TOTAL_STEPS}`} height={4} />
      <Text style={[styles.stepTitle, { color: colors.textPrimary }]} accessibilityRole="header">{STEPS[step]}</Text>

      {step === 0 && (
        <Animated.View entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)}>
          <View style={styles.stepContentWrap}>
          {templates.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{Copy.create.startFromTemplate}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll} contentContainerStyle={styles.templateScrollContent}>
                {templates.map((t) => (
                  <AnimatedPressable
                    key={t.id}
                    style={[styles.templateCard, { borderColor: t.theme_slug && THEME_ACCENT[t.theme_slug] ? THEME_ACCENT[t.theme_slug] : colors.inputBorder, backgroundColor: t.theme_slug && THEME_ACCENT[t.theme_slug] ? `${THEME_ACCENT[t.theme_slug]}18` : colors.card }]}
                    onPress={() => applyTemplate(t)}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${t.name} template`}>
                    <Text style={[styles.templateCardTitle, { color: colors.text }]}>{t.name}</Text>
                    {t.description ? <Text style={[styles.templateCardDesc, { color: colors.secondaryText }]} numberOfLines={2}>{t.description}</Text> : null}
                  </AnimatedPressable>
                ))}
              </ScrollView>
            </>
          )}
          <FloatingLabelInput
            label={Copy.placeholder.eventTitle}
            value={form.title}
            onChangeText={(t: string) => updateForm({ title: t })}
            onClear={() => updateForm({ title: '' })}
            returnKeyType="next"
            autoCapitalize="sentences"
            style={{ marginBottom: spacing.lg }}
          />
          {Platform.OS !== 'web' && (
            <>
              <Pressable
                style={pickerBtnStyle}
                onPress={() => setShowStartPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Pick start date and time">
                <Text style={styles.pickerBtnText}>{Copy.create.pickStartTime}</Text>
              </Pressable>
              {showStartPicker && (
                <DateTimePicker
                  value={new Date(form.startTime || Date.now())}
                  mode="datetime"
                  onChange={(_, d) => {
                    setShowStartPicker(false);
                    if (d) updateForm({ startTime: d.toISOString().slice(0, 16) });
                  }}
                />
              )}
            </>
          )}
          <FloatingLabelInput
            label={Copy.create.startTime}
            value={form.startTime}
            onChangeText={(t: string) => updateForm({ startTime: t })}
            onClear={() => updateForm({ startTime: '' })}
            returnKeyType="next"
            style={{ marginBottom: spacing.lg }}
          />
          {Platform.OS !== 'web' && (
            <>
              <Pressable
                style={pickerBtnStyle}
                onPress={() => setShowBellPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Pick bell date and time">
                <Text style={styles.pickerBtnText}>{Copy.create.pickBellTime}</Text>
              </Pressable>
              {showBellPicker && (
                <DateTimePicker
                  value={new Date(form.bellTime || Date.now())}
                  mode="datetime"
                  onChange={(_, d) => {
                    setShowBellPicker(false);
                    if (d) updateForm({ bellTime: d.toISOString().slice(0, 16) });
                  }}
                />
              )}
            </>
          )}
          <FloatingLabelInput
            label={Copy.create.bellTime}
            value={form.bellTime}
            onChangeText={(t: string) => updateForm({ bellTime: t })}
            onClear={() => updateForm({ bellTime: '' })}
            returnKeyType="next"
            style={{ marginBottom: spacing.lg }}
          />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{Copy.create.publicEvent}</Text>
            <Switch value={form.isPublic ?? false} onValueChange={(v) => updateForm({ isPublic: v })} trackColor={{ false: colors.inputBorder, true: colors.primaryButton }} thumbColor={colors.primaryButtonText} />
          </View>
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Cover Image (optional)</Text>
            <AnimatedPressable
              onPress={pickCoverImage}
              style={[styles.coverImagePicker, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
            >
              {form.coverImageUri ? (
                <Image
                  source={{ uri: form.coverImageUri }}
                  style={styles.coverImagePreview}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={styles.coverImagePlaceholder}>
                  <Ionicons name="image-outline" size={32} color={colors.placeholder} />
                  <Text style={[styles.coverImageHint, { color: colors.placeholder }]}>Tap to add a cover photo</Text>
                </View>
              )}
            </AnimatedPressable>
            {form.coverImageUri && (
              <Pressable onPress={() => setForm({ ...form, coverImageUri: null })} style={{ marginTop: spacing.sm }}>
                <Text style={{ color: colors.error, fontSize: typography.meta }}>Remove cover image</Text>
              </Pressable>
            )}
          </View>
          </View>
        </Animated.View>
      )}

      {step === 1 && (
        <Animated.View entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)}>
          <View style={styles.stepContentWrap}>
          <FloatingLabelInput
            label="Street address"
            value={form.addressLine1}
            onChangeText={(t: string) => updateForm({ addressLine1: t })}
            onClear={() => updateForm({ addressLine1: '' })}
            returnKeyType="next"
            autoComplete="street-address"
            autoCapitalize="words"
            style={{ marginBottom: spacing.lg }}
          />
          <FloatingLabelInput
            label={Copy.common.optional}
            value={form.addressLine2}
            onChangeText={(t: string) => updateForm({ addressLine2: t })}
            onClear={() => updateForm({ addressLine2: '' })}
            returnKeyType="next"
            autoCapitalize="words"
            style={{ marginBottom: spacing.lg }}
          />
          <FloatingLabelInput
            label="City"
            value={form.city}
            onChangeText={(t: string) => updateForm({ city: t })}
            onClear={() => updateForm({ city: '' })}
            returnKeyType="next"
            autoCapitalize="words"
            style={{ marginBottom: spacing.lg }}
          />
          <FloatingLabelInput
            label="State"
            value={form.state}
            onChangeText={(t: string) => updateForm({ state: t })}
            onClear={() => updateForm({ state: '' })}
            returnKeyType="next"
            autoCapitalize="characters"
            style={{ marginBottom: spacing.lg }}
          />
          <FloatingLabelInput
            label={Copy.placeholder.postalCode}
            value={form.postalCode}
            onChangeText={(t: string) => updateForm({ postalCode: t })}
            onClear={() => updateForm({ postalCode: '' })}
            returnKeyType="next"
            autoComplete="postal-code"
            style={{ marginBottom: spacing.lg }}
          />
          <FloatingLabelInput
            label={Copy.placeholder.country}
            value={form.country}
            onChangeText={(t: string) => updateForm({ country: t })}
            onClear={() => updateForm({ country: '' })}
            returnKeyType="next"
            autoCapitalize="words"
            style={{ marginBottom: spacing.lg }}
          />
          <FloatingLabelInput
            label={Copy.placeholder.locationNotes}
            value={form.locationNotes}
            onChangeText={(t: string) => updateForm({ locationNotes: t })}
            onClear={() => updateForm({ locationNotes: '' })}
            multiline
            returnKeyType="done"
            style={{ marginBottom: spacing.lg, minHeight: 80 }}
          />
          <Pressable
            style={styles.buttonSecondary}
            onPress={() => Clipboard.setStringAsync(fullAddressFromForm(form))}
            accessibilityRole="button"
            accessibilityLabel="Copy address to clipboard">
            <Text style={styles.buttonSecondaryText}>{Copy.create.copyAddress}</Text>
          </Pressable>
          </View>
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)}>
          <View style={styles.stepContentWrap}>
          {form.menuSections.map((sec, si) => (
            <View key={sec.id} style={styles.section}>
              <FloatingLabelInput
                label={Copy.placeholder.sectionTitle}
                value={sec.title}
                onChangeText={(t: string) => {
                  const next = [...form.menuSections];
                  next[si] = { ...next[si], title: t };
                  updateForm({ menuSections: next });
                }}
                onClear={() => {
                  const next = [...form.menuSections];
                  next[si] = { ...next[si], title: '' };
                  updateForm({ menuSections: next });
                }}
                returnKeyType="next"
                autoCapitalize="words"
                style={{ marginBottom: spacing.lg }}
              />
              {sec.items.map((item, ii) => (
                <View key={item.id} style={styles.row}>
                  <FloatingLabelInput
                    label={Copy.placeholder.menuItemName}
                    value={item.name}
                    onChangeText={(t: string) => {
                      const next = [...form.menuSections];
                      next[si].items = [...next[si].items];
                      next[si].items[ii] = { ...next[si].items[ii], name: t };
                      updateForm({ menuSections: next });
                    }}
                    onClear={() => {
                      const next = [...form.menuSections];
                      next[si].items = [...next[si].items];
                      next[si].items[ii] = { ...next[si].items[ii], name: '' };
                      updateForm({ menuSections: next });
                    }}
                    returnKeyType="done"
                    autoCapitalize="sentences"
                    style={{ marginBottom: spacing.lg }}
                  />
                </View>
              ))}
              <Pressable
                onPress={() => {
                  const next = [...form.menuSections];
                  next[si] = {
                    ...next[si],
                    items: [...next[si].items, { id: generateId(), name: '', notes: '', dietaryTags: [] }],
                  };
                  updateForm({ menuSections: next });
                }}
                accessibilityRole="button"
                accessibilityLabel="Add menu item">
                <Text style={[styles.link, { color: colors.tint }]}>+ Add item</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={() =>
              updateForm({
                menuSections: [...form.menuSections, { id: generateId(), title: 'New section', items: [] }],
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Add menu section">
            <Text style={[styles.link, { color: colors.tint }]}>+ Add section</Text>
          </Pressable>
          </View>
        </Animated.View>
      )}

      {step === 3 && (
        <Animated.View entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)}>
          <View style={styles.stepContentWrap}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{Copy.create.quickAdd}</Text>
          <View style={styles.quickAddRow}>
            {[
              { name: 'Drinks', category: 'drink' as const },
              { name: 'Dessert', category: 'dessert' as const },
              { name: 'Ice', category: 'supplies' as const },
              { name: 'Plates', category: 'supplies' as const },
            ].map(({ name, category }) => (
              <Pressable
                key={name}
                style={[styles.quickAddChip, { borderColor: colors.inputBorder }]}
                onPress={() =>
                  updateForm({
                    bringItems: [
                      ...form.bringItems,
                      { id: generateId(), name, quantity: '1', category, isRequired: false, isClaimable: true, notes: '' },
                    ],
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Quick add ${name}`}>
                <Text style={[styles.quickAddChipText, { color: colors.tint }]}>{name}</Text>
              </Pressable>
            ))}
          </View>
          {form.bringItems.map((item, ii) => (
            <View key={item.id} style={[styles.bringItemBlock, { borderBottomColor: colors.border }]}>
              <View style={styles.bringRow}>
                <FloatingLabelInput
                  label={Copy.placeholder.menuItemName}
                  value={item.name}
                  onChangeText={(t: string) => {
                    const next = [...form.bringItems];
                    next[ii] = { ...next[ii], name: t };
                    updateForm({ bringItems: next });
                  }}
                  onClear={() => {
                    const next = [...form.bringItems];
                    next[ii] = { ...next[ii], name: '' };
                    updateForm({ bringItems: next });
                  }}
                  returnKeyType="next"
                  autoCapitalize="sentences"
                  style={{ flex: 1, marginBottom: spacing.lg }}
                />
                <FloatingLabelInput
                  label={Copy.placeholder.quantity}
                  value={item.quantity}
                  onChangeText={(t: string) => {
                    const next = [...form.bringItems];
                    next[ii] = { ...next[ii], quantity: t };
                    updateForm({ bringItems: next });
                  }}
                  onClear={() => {
                    const next = [...form.bringItems];
                    next[ii] = { ...next[ii], quantity: '' };
                    updateForm({ bringItems: next });
                  }}
                  returnKeyType="done"
                  style={{ width: 80, marginBottom: spacing.lg }}
                />
              </View>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{Copy.create.category}</Text>
              <View style={styles.categoryRow}>
                {BRING_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[styles.categoryBtn, { borderColor: colors.border }, item.category === cat && { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton }]}
                    onPress={() => {
                      const next = [...form.bringItems];
                      next[ii] = { ...next[ii], category: cat };
                      updateForm({ bringItems: next });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Set category to ${cat}`}>
                    <Text style={[styles.categoryBtnText, item.category === cat && { color: colors.primaryButtonText }]}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{Copy.create.claimable}</Text>
                <Switch
                  value={item.isClaimable}
                  onValueChange={(v) => {
                    const next = [...form.bringItems];
                    next[ii] = { ...next[ii], isClaimable: v };
                    updateForm({ bringItems: next });
                  }}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{Copy.create.required}</Text>
                <Switch
                  value={item.isRequired}
                  onValueChange={(v) => {
                    const next = [...form.bringItems];
                    next[ii] = { ...next[ii], isRequired: v };
                    updateForm({ bringItems: next });
                  }}
                />
              </View>
            </View>
          ))}
          <Pressable
            onPress={() =>
              updateForm({
                bringItems: [
                  ...form.bringItems,
                  { id: generateId(), name: '', quantity: '1', category: 'other', isRequired: false, isClaimable: true, notes: '' },
                ],
              })
            }
          >
            <Text style={[styles.link, { color: colors.tint }]}>{Copy.event.addBringItem}</Text>
          </Pressable>
          </View>
        </Animated.View>
      )}

      {step === 4 && (
        <Animated.View entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)}>
          <View style={styles.stepContentWrap}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{Copy.create.inviteNoteTemplates}</Text>
          <View style={styles.quickAddRow}>
            {INVITE_NOTE_TEMPLATES.map((template) => (
              <Pressable
                key={template}
                style={[styles.quickAddChip, { borderColor: colors.inputBorder }]}
                onPress={() => updateForm({ noteToGuests: template })}
                accessibilityRole="button"
                accessibilityLabel={`Use note template: ${template}`}>
                <Text style={[styles.quickAddChipText, { color: colors.tint }]} numberOfLines={2}>
                  {template}
                </Text>
              </Pressable>
            ))}
          </View>
          <FloatingLabelInput
            label={Copy.placeholder.noteToGuests}
            value={form.noteToGuests}
            onChangeText={(t: string) => updateForm({ noteToGuests: t })}
            onClear={() => updateForm({ noteToGuests: '' })}
            multiline
            returnKeyType="done"
            autoCapitalize="sentences"
            style={{ marginBottom: spacing.lg, minHeight: 80 }}
          />
          {groups.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{Copy.create.inviteGroup}</Text>
              <View style={styles.quickAddRow}>
                {groups.map((g) => (
                  <Pressable
                    key={g.id}
                    style={[styles.quickAddChip, { borderColor: colors.inputBorder }]}
                    onPress={async () => {
                      const members = await getGroupMembers(g.id);
                      const contacts = members.map((m) => m.contact_value.trim()).filter(Boolean);
                      const combined = [...new Set([...form.guestEmails, ...contacts])];
                      updateForm({ guestEmails: combined });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Invite group ${g.name}`}>
                    <Text style={[styles.quickAddChipText, { color: colors.tint }]}>{g.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {Platform.OS !== 'web' && (
            <>
              <Text style={styles.hint}>Invite from contacts and we will text or email them automatically.</Text>
              <Pressable
                style={[styles.buttonSecondary, { borderColor: colors.inputBorder }]}
                onPress={() => {
                  contactsPicker.openPicker();
                  contactsSheetRef.current?.snapToIndex(0);
                }}
                accessibilityRole="button"
                accessibilityLabel="Add guests from contacts">
                <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>{Copy.common.addFromContacts}</Text>
              </Pressable>
            </>
          )}
          <FloatingLabelInput
            label={Copy.placeholder.guestsInput}
            value={form.guestEmails.join(', ')}
            onChangeText={(t: string) => updateForm({ guestEmails: t.split(/[\n,]/).map((e: string) => e.trim()).filter(Boolean) })}
            onClear={() => updateForm({ guestEmails: [] })}
            multiline
            returnKeyType="done"
            autoCapitalize="none"
            style={{ marginBottom: spacing.lg, minHeight: 80 }}
          />
          <Text style={styles.hint}>{Copy.create.shareInviteAfter}</Text>
          </View>
        </Animated.View>
      )}

      {step === 5 && (
        <Animated.View entering={FadeInRight.duration(300)} exiting={FadeOutLeft.duration(200)}>
          <View style={styles.stepContentWrap}>
          <View style={styles.summary}>
            <Text style={[styles.almostThere, { color: colors.secondaryText }]}>{Copy.create.almostThere}</Text>
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <Text style={styles.summaryTitle}>{form.title}</Text>
              <Text style={[styles.summaryText, { color: colors.secondaryText }]}>
                {Copy.create.bellLabel}{formatBellTime(form.bellTime)}
              </Text>
              <Text style={[styles.summaryText, { color: colors.secondaryText }]}>
                {form.addressLine1}, {form.city}
              </Text>
              <Text style={[styles.summaryText, { color: colors.secondaryText }]}>
                {Copy.create.menuSectionsLabel}{form.menuSections.length}
              </Text>
              <Text style={[styles.summaryText, { color: colors.secondaryText }]}>
                Bring items: {form.bringItems.length}
              </Text>
            </View>
          </View>
          </View>
        </Animated.View>
      )}

      {error ? (
        <Card style={{ marginBottom: spacing.md }}>
          <CardBody style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={[styles.error, { color: colors.error, marginBottom: 0, flex: 1 }]}>{error}</Text>
          </CardBody>
        </Card>
      ) : null}

      {Platform.OS !== 'web' && (
        <AppBottomSheet
          ref={contactsSheetRef}
          index={-1}
          snapPoints={['70%']}
          onClose={() => contactsPicker.setModalVisible(false)}
          title={Copy.common.addFromContacts}
          scrollable
        >
          {contactsPicker.contactsError ? (
            <Text style={[styles.modalError, { color: colors.error }]}>{contactsPicker.contactsError}</Text>
          ) : contactsPicker.contactsLoading ? (
            <View style={styles.contactsSkeletonWrap}>
              <SkeletonLoader height={44} borderRadius={8} style={styles.contactsSkeletonRow} />
              <SkeletonLoader height={44} borderRadius={8} style={styles.contactsSkeletonRow} />
              <SkeletonLoader height={44} borderRadius={8} style={styles.contactsSkeletonRow} />
            </View>
          ) : contactsPicker.contactsList.length === 0 ? (
            <Text style={styles.hint}>{Copy.common.noContactsFound}</Text>
          ) : (
            <>
              <FlatList
                data={contactsPicker.contactsList}
                keyExtractor={(item) => item.id}
                style={styles.contactsList}
                renderItem={({ item }) => (
                  <ContactRow
                    item={item}
                    isSelected={contactsPicker.selectedIds.has(item.id)}
                    onToggle={contactsPicker.toggleSelection}
                    inputBorderColor={colors.inputBorder}
                    borderColor={colors.border}
                    tintColor={colors.tint}
                  />
                )}
              />
              <Pressable
                style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }, contactsPicker.selectedIds.size === 0 && styles.btnDisabled]}
                onPress={handleAddSelectedContactsToGuests}
                disabled={contactsPicker.selectedIds.size === 0}
                accessibilityRole="button"
                accessibilityLabel={`Add ${contactsPicker.selectedIds.size} selected contacts`}>
                <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>
                  {Copy.common.addSelected(contactsPicker.selectedIds.size)}
                </Text>
              </Pressable>
            </>
          )}
          <Pressable style={styles.modalCancel} onPress={() => contactsSheetRef.current?.close()}>
            <Text style={styles.modalCancelText}>{Copy.common.cancel}</Text>
          </Pressable>
        </AppBottomSheet>
      )}

      <View style={styles.footer}>
        {step > 0 && (
          <AnimatedPressable
            variant="secondary"
            enableHaptics
            style={[styles.btnSecondary, { borderColor: colors.inputBorder }]}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Previous step">
            <Text style={[styles.btnSecondaryText, { color: colors.text }]}>{Copy.common.back}</Text>
          </AnimatedPressable>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <AnimatedPressable
            variant="primary"
            enableHaptics
            style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }]}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel="Next step">
            <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>{Copy.common.next}</Text>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable
            variant="primary"
            enableHaptics
            style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }, saving && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Create and send event">
            <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>
              {saving ? Copy.create.creating : Copy.create.createAndSend}
            </Text>
          </AnimatedPressable>
        )}
      </View>
      {draftSavedLabel && (
        <Animated.View entering={FadeInDown.duration(200)}>
          <View>
            <Text style={[styles.draftSavedText, { color: colors.secondaryText }]}>Draft saved</Text>
          </View>
        </Animated.View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + spacing.sm },
  stepProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.xs,
  },
  successWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    padding: spacing.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
  },
  successHeadline: {
    fontSize: typography.title,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successBody: {
    fontSize: typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: lineHeight.body,
  },
  successCta: { width: '100%', marginBottom: spacing.sm },
  successSecondary: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  successSecondaryText: { fontSize: typography.body, fontWeight: '600' },
  stepTitle: { fontSize: typography.headline, fontWeight: '600', marginBottom: spacing.lg },
  stepContentWrap: {},
  label: { fontSize: typography.meta, fontWeight: '500', marginBottom: spacing.xs + 2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    padding: spacing.md,
    fontSize: typography.body,
    marginBottom: spacing.lg,
  },
  textArea: { minHeight: 80 },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: typography.body, fontWeight: '600', marginBottom: spacing.sm },
  itemText: { fontSize: typography.meta, marginBottom: spacing.xs },
  row: { marginBottom: spacing.sm },
  bringRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  quickAddRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  quickAddChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: spacing.sm, borderWidth: 1 },
  quickAddChipText: { fontSize: typography.meta, fontWeight: '500' },
  bringItemBlock: { marginBottom: spacing.lg + spacing.xs, paddingBottom: spacing.md, borderBottomWidth: 1 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginBottom: spacing.sm },
  categoryBtn: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.sm + 2, borderRadius: spacing.sm, borderWidth: 1 },
  categoryBtnText: { fontSize: typography.microLabel },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  toggleLabel: { fontSize: typography.meta },
  pickerBtn: { padding: spacing.md, borderRadius: spacing.sm, marginBottom: spacing.sm },
  pickerBtnText: { fontSize: typography.meta, fontWeight: '500' },
  buttonSecondary: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  buttonSecondaryText: { fontWeight: '600' },
  link: { fontSize: typography.body, marginTop: spacing.sm },
  hint: { fontSize: typography.microLabel, opacity: 0.7, marginTop: spacing.sm },
  summary: { marginBottom: spacing.xl },
  almostThere: { fontSize: typography.body, marginBottom: spacing.md, fontWeight: '600' },
  summaryCard: { padding: spacing.lg, borderRadius: radius.input, marginBottom: spacing.sm },
  summaryTitle: { fontSize: typography.h3, fontWeight: '600', marginBottom: spacing.sm },
  summaryText: { fontSize: typography.meta, marginBottom: spacing.xs },
  error: { marginBottom: spacing.md },
  footer: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  btnPrimary: { flex: 1, padding: spacing.lg, borderRadius: radius.input, alignItems: 'center' },
  btnPrimaryText: { fontWeight: '600' },
  btnSecondary: { padding: spacing.lg, borderRadius: radius.input, alignItems: 'center', borderWidth: 1 },
  btnSecondaryText: { fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  templateScroll: { marginBottom: spacing.lg },
  templateScrollContent: { gap: spacing.md },
  templateCard: { width: 140, padding: spacing.md, borderRadius: radius.input, borderWidth: 1 },
  templateCardTitle: { fontSize: typography.body, fontWeight: '600', marginBottom: spacing.xs },
  templateCardDesc: { fontSize: typography.microLabel },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modalContent: { borderRadius: spacing.lg, padding: spacing.xl, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: typography.h3, fontWeight: '600', marginBottom: spacing.lg },
  modalError: { marginBottom: spacing.sm },
  modalCancel: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  modalCancelText: { fontWeight: '500' },
  contactsModalContent: { maxHeight: '80%' },
  contactsSkeletonWrap: { gap: spacing.sm, marginBottom: spacing.md },
  contactsSkeletonRow: { marginBottom: 0 },
  contactsList: { maxHeight: 280, marginBottom: spacing.md },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1 },
  contactRowName: { flex: 1, fontSize: typography.body, fontWeight: '500' },
  contactRowPhone: { fontSize: typography.meta, opacity: 0.8, marginRight: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: spacing.xs + 2, borderWidth: 2 },
  draftPromptOverlay: {
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  draftPromptTitle: {
    fontSize: typography.h3,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  draftPromptBody: {
    fontSize: typography.meta,
    marginBottom: spacing.md,
    lineHeight: lineHeight.small,
  },
  draftPromptActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  draftPromptBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.input,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  draftPromptBtnText: {
    fontWeight: '600',
    fontSize: typography.body,
  },
  draftSavedText: {
    textAlign: 'center',
    fontSize: typography.microLabel,
    marginTop: spacing.sm,
    opacity: 0.7,
  },
  sectionLabel: {
    fontSize: typography.meta,
    fontWeight: '500',
    marginBottom: spacing.xs + 2,
  },
  coverImagePicker: {
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
    height: 160,
    borderStyle: 'dashed',
  },
  coverImagePreview: {
    width: '100%',
    height: '100%',
  },
  coverImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  coverImageHint: {
    fontSize: typography.meta,
  },
});

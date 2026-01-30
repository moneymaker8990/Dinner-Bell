import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { defaultForm, generateId, type CreateEventForm } from '@/lib/eventForm';
import { fetchGroups, getGroupMembers, type GuestGroup } from '@/lib/groups';
import { addGuestByHost, addGuestByHostPhone } from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import { fetchTemplates, THEME_ACCENT, type EventTemplate } from '@/lib/templates';
import { useContactsPicker } from '@/lib/useContactsPicker';
import type { BringItemCategory } from '@/types/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';

const STEPS = ['Basics', 'Location', 'Menu', 'Bring List', 'Invite', 'Review'];
const TOTAL_STEPS = 6;
const BRING_CATEGORIES: BringItemCategory[] = ['drink', 'side', 'dessert', 'supplies', 'other'];

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

export default function CreateDinnerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ duplicateEventId?: string }>();
  const duplicateEventId = params.duplicateEventId;
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateEventForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showBellPicker, setShowBellPicker] = useState(false);
  const [groups, setGroups] = useState<GuestGroup[]>([]);
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const hasNavigatedRef = useRef(false);
  const contactsPicker = useContactsPicker();

  useEffect(() => {
    if (!user) return;
    fetchGroups().then(setGroups);
  }, [user?.id]);

  useEffect(() => {
    fetchTemplates().then(setTemplates);
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
        bellSound: (e.bell_sound as CreateEventForm['bellSound']) ?? 'triangle',
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

  const updateForm = useCallback((updates: Partial<CreateEventForm>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
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

  const inputStyle = [styles.input, { borderColor: colors.inputBorder }];
  const pickerBtnStyle = [styles.pickerBtn, { backgroundColor: colors.card }];

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.stepTitle}>Sign in to create an event</Text>
        <Pressable style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }]} onPress={() => router.push('/sign-in')}>
          <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const inviteToken = generateToken();
      const { data: eventId, error: eventError } = await (supabase as any).rpc('create_event', {
        p_title: form.title,
        p_description: form.description || null,
        p_start_time: form.startTime,
        p_bell_time: form.bellTime,
        p_bell_sound: form.bellSound || 'triangle',
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
        setError(eventError?.message ?? 'Failed to create event');
        setSaving(false);
        return;
      }

      for (let i = 0; i < form.menuSections.length; i++) {
        const sec = form.menuSections[i];
        const { data: sectionData, error: sectionError } = await (supabase as any)
          .from('menu_sections')
          .insert({ event_id: eventId, title: sec.title, sort_order: i })
          .select('id')
          .single();
        if (sectionError || !sectionData) continue;
        const sectionId = (sectionData as { id: string }).id;
        for (let j = 0; j < sec.items.length; j++) {
          await (supabase as any).from('menu_items').insert({
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
        await (supabase as any).from('bring_items').insert({
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
        await (supabase as any).from('schedule_blocks').insert({
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
      await (supabase as any).from('notification_schedules').insert([
        { event_id: eventId, scheduled_at: reminder2h.toISOString(), type: 'reminder_2h' },
        { event_id: eventId, scheduled_at: reminder30.toISOString(), type: 'reminder_30m' },
        { event_id: eventId, scheduled_at: form.bellTime, type: 'bell' },
      ]);

      for (const contact of form.guestEmails) {
        const trimmed = contact.trim();
        if (!trimmed) continue;
        if (trimmed.includes('@')) {
          await addGuestByHost(eventId, trimmed);
        } else {
          await addGuestByHostPhone(eventId, trimmed);
        }
      }

      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        router.replace(`/event/${eventId}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSelectedContactsToGuests = () => {
    if (contactsPicker.selectedIds.size === 0) return;
    const phones = contactsPicker.contactsList
      .filter((c) => contactsPicker.selectedIds.has(c.id))
      .map((c) => c.phone);
    const combined = [...new Set([...form.guestEmails, ...phones])];
    updateForm({ guestEmails: combined });
    contactsPicker.setModalVisible(false);
    contactsPicker.setSelectedIds(new Set());
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.stepTitle}>{STEPS[step]}</Text>

      {step === 0 && (
        <>
          {templates.length > 0 && (
            <>
              <Text style={styles.label}>Start from template</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll} contentContainerStyle={styles.templateScrollContent}>
                {templates.map((t) => (
                  <Pressable
                    key={t.id}
                    style={[styles.templateCard, { borderColor: t.theme_slug && THEME_ACCENT[t.theme_slug] ? THEME_ACCENT[t.theme_slug] : colors.inputBorder, backgroundColor: t.theme_slug && THEME_ACCENT[t.theme_slug] ? `${THEME_ACCENT[t.theme_slug]}18` : colors.card }]}
                    onPress={() => applyTemplate(t)}
                  >
                    <Text style={[styles.templateCardTitle, { color: colors.text }]}>{t.name}</Text>
                    {t.description ? <Text style={[styles.templateCardDesc, { color: colors.secondaryText }]} numberOfLines={2}>{t.description}</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={inputStyle}
            value={form.title}
            onChangeText={(t: string) => updateForm({ title: t })}
            placeholder="e.g. Thursday Dinner at Caleb's"
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>Start time</Text>
          {Platform.OS !== 'web' && (
            <>
              <Pressable style={pickerBtnStyle} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.pickerBtnText}>Pick start date & time</Text>
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
          <TextInput
            style={inputStyle}
            value={form.startTime}
            onChangeText={(t: string) => updateForm({ startTime: t })}
            placeholder="YYYY-MM-DDTHH:mm"
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>Bell time</Text>
          {Platform.OS !== 'web' && (
            <>
              <Pressable style={pickerBtnStyle} onPress={() => setShowBellPicker(true)}>
                <Text style={styles.pickerBtnText}>Pick bell date & time</Text>
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
          <TextInput
            style={inputStyle}
            value={form.bellTime}
            onChangeText={(t: string) => updateForm({ bellTime: t })}
            placeholder="YYYY-MM-DDTHH:mm"
            placeholderTextColor="#888"
          />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>List in Discover (public event)</Text>
            <Switch value={form.isPublic ?? false} onValueChange={(v) => updateForm({ isPublic: v })} trackColor={{ false: colors.inputBorder, true: colors.primaryButton }} thumbColor="#fff" />
          </View>
        </>
      )}

      {step === 1 && (
        <>
          <Text style={styles.label}>Address line 1</Text>
          <TextInput
            style={inputStyle}
            value={form.addressLine1}
            onChangeText={(t: string) => updateForm({ addressLine1: t })}
            placeholder="Street address"
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>Unit / Apt</Text>
          <TextInput
            style={inputStyle}
            value={form.addressLine2}
            onChangeText={(t: string) => updateForm({ addressLine2: t })}
            placeholder="Optional"
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>City</Text>
          <TextInput
            style={inputStyle}
            value={form.city}
            onChangeText={(t: string) => updateForm({ city: t })}
            placeholder="City"
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>State</Text>
          <TextInput
            style={inputStyle}
            value={form.state}
            onChangeText={(t: string) => updateForm({ state: t })}
            placeholder="State"
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>Postal code</Text>
          <TextInput
            style={inputStyle}
            value={form.postalCode}
            onChangeText={(t: string) => updateForm({ postalCode: t })}
            placeholder="Postal code"
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>Country</Text>
          <TextInput
            style={inputStyle}
            value={form.country}
            onChangeText={(t: string) => updateForm({ country: t })}
            placeholder="Country"
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>Location notes (parking, gate code)</Text>
          <TextInput
            style={[inputStyle, styles.textArea]}
            value={form.locationNotes}
            onChangeText={(t: string) => updateForm({ locationNotes: t })}
            placeholder="Optional"
            placeholderTextColor="#888"
            multiline
          />
          <Pressable style={styles.buttonSecondary} onPress={() => Clipboard.setStringAsync(fullAddressFromForm(form))}>
            <Text style={styles.buttonSecondaryText}>Copy address</Text>
          </Pressable>
        </>
      )}

      {step === 2 && (
        <>
          {form.menuSections.map((sec, si) => (
            <View key={sec.id} style={styles.section}>
              <Text style={styles.label}>Section title</Text>
              <TextInput
                style={inputStyle}
                value={sec.title}
                onChangeText={(t: string) => {
                  const next = [...form.menuSections];
                  next[si] = { ...next[si], title: t };
                  updateForm({ menuSections: next });
                }}
                placeholder="e.g. Main, Dessert"
                placeholderTextColor="#888"
              />
              {sec.items.map((item, ii) => (
                <View key={item.id} style={styles.row}>
                  <TextInput
                    style={inputStyle}
                    value={item.name}
                    onChangeText={(t: string) => {
                      const next = [...form.menuSections];
                      next[si].items = [...next[si].items];
                      next[si].items[ii] = { ...next[si].items[ii], name: t };
                      updateForm({ menuSections: next });
                    }}
                    placeholder="Item name"
                    placeholderTextColor="#888"
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
              >
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
          >
            <Text style={[styles.link, { color: colors.tint }]}>+ Add section</Text>
          </Pressable>
        </>
      )}

      {step === 3 && (
        <>
          <Text style={styles.label}>Quick add</Text>
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
              >
                <Text style={[styles.quickAddChipText, { color: colors.tint }]}>{name}</Text>
              </Pressable>
            ))}
          </View>
          {form.bringItems.map((item, ii) => (
            <View key={item.id} style={styles.bringItemBlock}>
              <View style={styles.bringRow}>
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  value={item.name}
                  onChangeText={(t: string) => {
                    const next = [...form.bringItems];
                    next[ii] = { ...next[ii], name: t };
                    updateForm({ bringItems: next });
                  }}
                  placeholder="Item name"
                  placeholderTextColor="#888"
                />
                <TextInput
                  style={[inputStyle, { width: 80 }]}
                  value={item.quantity}
                  onChangeText={(t: string) => {
                    const next = [...form.bringItems];
                    next[ii] = { ...next[ii], quantity: t };
                    updateForm({ bringItems: next });
                  }}
                  placeholder="Qty"
                  placeholderTextColor="#888"
                />
              </View>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryRow}>
                {BRING_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[styles.categoryBtn, item.category === cat && { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton }]}
                    onPress={() => {
                      const next = [...form.bringItems];
                      next[ii] = { ...next[ii], category: cat };
                      updateForm({ bringItems: next });
                    }}
                  >
                    <Text style={[styles.categoryBtnText, item.category === cat && { color: colors.primaryButtonText }]}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Claimable</Text>
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
                <Text style={styles.toggleLabel}>Required</Text>
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
            <Text style={[styles.link, { color: colors.tint }]}>+ Add bring item</Text>
          </Pressable>
        </>
      )}

      {step === 4 && (
        <>
          <Text style={styles.label}>Note to guests (optional)</Text>
          <TextInput
            style={[inputStyle, styles.textArea]}
            value={form.noteToGuests}
            onChangeText={(t: string) => updateForm({ noteToGuests: t })}
            placeholder="e.g. Can't wait to see you! Bring your appetite."
            placeholderTextColor="#888"
            multiline
          />
          {groups.length > 0 && (
            <>
              <Text style={styles.label}>Invite a group</Text>
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
                  >
                    <Text style={[styles.quickAddChipText, { color: colors.tint }]}>{g.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {Platform.OS !== 'web' && (
            <Pressable style={[styles.buttonSecondary, { borderColor: colors.inputBorder }]} onPress={contactsPicker.openPicker}>
              <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Add from contacts</Text>
            </Pressable>
          )}
          <Text style={styles.label}>Guests (email or phone, one per line or comma-separated)</Text>
          <TextInput
            style={[inputStyle, styles.textArea]}
            value={form.guestEmails.join(', ')}
            onChangeText={(t: string) => updateForm({ guestEmails: t.split(/[\n,]/).map((e: string) => e.trim()).filter(Boolean) })}
            placeholder="email@example.com or 5551234567"
            placeholderTextColor="#888"
            multiline
          />
          <Text style={styles.hint}>Or share the invite link after creating the event.</Text>
        </>
      )}

      {step === 5 && (
        <View style={styles.summary}>
          <Text style={[styles.almostThere, { color: colors.secondaryText }]}>Almost there!</Text>
          <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
            <Text style={styles.summaryTitle}>{form.title}</Text>
            <Text style={[styles.summaryText, { color: colors.secondaryText }]}>
              Bell: {formatBellTime(form.bellTime)}
            </Text>
            <Text style={[styles.summaryText, { color: colors.secondaryText }]}>
              {form.addressLine1}, {form.city}
            </Text>
            <Text style={[styles.summaryText, { color: colors.secondaryText }]}>
              Menu sections: {form.menuSections.length}
            </Text>
            <Text style={[styles.summaryText, { color: colors.secondaryText }]}>
              Bring items: {form.bringItems.length}
            </Text>
          </View>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {Platform.OS !== 'web' && (
        <Modal visible={contactsPicker.modalVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => contactsPicker.setModalVisible(false)}>
            <Pressable style={[styles.modalContent, styles.contactsModalContent, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Add from contacts</Text>
              {contactsPicker.contactsError ? (
                <Text style={styles.modalError}>{contactsPicker.contactsError}</Text>
              ) : contactsPicker.contactsLoading ? (
                <Text style={styles.hint}>Loading contacts...</Text>
              ) : contactsPicker.contactsList.length === 0 ? (
                <Text style={styles.hint}>No contacts with phone numbers found.</Text>
              ) : (
                <>
                  <FlatList
                    data={contactsPicker.contactsList}
                    keyExtractor={(item) => item.id}
                    style={styles.contactsList}
                    renderItem={({ item }) => (
                      <Pressable
                        style={[styles.contactRow, { borderColor: colors.inputBorder }]}
                        onPress={() => contactsPicker.toggleSelection(item.id)}
                      >
                        <Text style={styles.contactRowName}>{item.name}</Text>
                        <Text style={styles.contactRowPhone}>{item.phone}</Text>
                        <View style={[styles.checkbox, contactsPicker.selectedIds.has(item.id) && { backgroundColor: colors.tint }]} />
                      </Pressable>
                    )}
                  />
                  <Pressable
                    style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }, contactsPicker.selectedIds.size === 0 && styles.btnDisabled]}
                    onPress={handleAddSelectedContactsToGuests}
                    disabled={contactsPicker.selectedIds.size === 0}
                  >
                    <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>
                      Add selected ({contactsPicker.selectedIds.size})
                    </Text>
                  </Pressable>
                </>
              )}
              <Pressable style={styles.modalCancel} onPress={() => contactsPicker.setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <View style={styles.footer}>
        {step > 0 && (
          <Pressable style={[styles.btnSecondary, { borderColor: colors.inputBorder }]} onPress={handleBack}>
            <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Back</Text>
          </Pressable>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <Pressable style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }]} onPress={handleNext}>
            <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>Next</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }, saving && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>
              {saving ? 'Creating...' : 'Create & Send'}
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  stepTitle: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: { minHeight: 80 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  itemText: { fontSize: 14, marginBottom: 4 },
  row: { marginBottom: 8 },
  bringRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickAddRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  quickAddChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1 },
  quickAddChipText: { fontSize: 14, fontWeight: '500' },
  bringItemBlock: { marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(128,128,128,0.2)' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  categoryBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ccc' },
  categoryBtnActive: { backgroundColor: '#2f95dc', borderColor: '#2f95dc' },
  categoryBtnText: { fontSize: 12 },
  categoryBtnTextActive: { color: '#fff' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  toggleLabel: { fontSize: 14 },
  pickerBtn: { padding: 12, borderRadius: 8, backgroundColor: '#eee', marginBottom: 8 },
  pickerBtnText: { fontSize: 14, fontWeight: '500' },
  buttonSecondary: { padding: 12, alignItems: 'center', marginTop: 8 },
  buttonSecondaryText: { fontWeight: '600' },
  link: { fontSize: 16, color: '#2f95dc', marginTop: 8 },
  hint: { fontSize: 12, opacity: 0.7, marginTop: 8 },
  summary: { marginBottom: 24 },
  almostThere: { fontSize: 16, marginBottom: 12, fontWeight: '600' },
  summaryCard: { padding: 16, borderRadius: 12, marginBottom: 8 },
  summaryTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  summaryText: { fontSize: 14, marginBottom: 4 },
  error: { color: '#c00', marginBottom: 12 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btnPrimary: { flex: 1, padding: 16, borderRadius: 8, alignItems: 'center' },
  btnPrimaryText: { fontWeight: '600' },
  btnSecondary: { padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  btnSecondaryText: { fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  templateScroll: { marginHorizontal: -20, marginBottom: 16 },
  templateScrollContent: { paddingHorizontal: 20, gap: 12 },
  templateCard: { width: 140, padding: 12, borderRadius: 12, borderWidth: 1 },
  templateCardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  templateCardDesc: { fontSize: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggleLabel: { fontSize: 14, flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  modalError: { color: '#c00', marginBottom: 8 },
  modalCancel: { padding: 12, alignItems: 'center', marginTop: 8 },
  modalCancelText: { fontWeight: '500' },
  contactsModalContent: { maxHeight: '80%' },
  contactsList: { maxHeight: 280, marginBottom: 12 },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  contactRowName: { flex: 1, fontSize: 16, fontWeight: '500' },
  contactRowPhone: { fontSize: 14, opacity: 0.8, marginRight: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#888' },
});

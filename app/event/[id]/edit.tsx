import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Card, CardBody } from '@/components/Card';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { SkeletonCardList } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { radius, spacing, typography } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { trackEventEdited } from '@/lib/analytics';
import type { CreateEventForm } from '@/lib/eventForm';
import { generateId } from '@/lib/eventForm';
import { queryClient } from '@/lib/queryClient';
import { rescheduleNotificationsForEvent } from '@/lib/rescheduleNotifications';
import { supabase } from '@/lib/supabase';
import type { BringItemRow, EventWithDetails, MenuItemRow, MenuSection, ScheduleBlockRow } from '@/types/events';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch } from 'react-native';

const STEPS = [
  Copy.create.stepBasics,
  Copy.create.stepLocation,
  Copy.create.stepMenu,
  Copy.create.stepBringList,
  Copy.create.stepSchedule,
  Copy.create.stepHostTools,
  Copy.create.stepReview,
];
const TOTAL_STEPS = 7;

function formFromEvent(
  e: EventWithDetails,
  sections: (MenuSection & { menu_items: MenuItemRow[] })[],
  bring: BringItemRow[],
  blocks: ScheduleBlockRow[]
): CreateEventForm {
  return {
    title: e.title,
    description: e.description || '',
    startTime: e.start_time.slice(0, 16),
    bellTime: e.bell_time.slice(0, 16),
    bellSound: ((e as EventWithDetails & { bell_sound?: string }).bell_sound as CreateEventForm['bellSound']) ?? 'triangle',
    endTime: e.end_time ? e.end_time.slice(0, 16) : '',
    timezone: e.timezone || 'UTC',
    addressLine1: e.address_line1 || '',
    addressLine2: e.address_line2 || '',
    city: e.city || '',
    state: e.state || '',
    postalCode: e.postal_code || '',
    country: e.country || '',
    locationName: e.location_name || '',
    locationNotes: e.location_notes || '',
    menuSections: sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      items: sec.menu_items.map((it) => ({
        id: it.id,
        name: it.name,
        notes: it.notes || '',
        dietaryTags: it.dietary_tags || [],
      })),
    })),
    bringItems: bring.map((b) => ({
      id: b.id,
      name: b.name,
      quantity: b.quantity,
      category: b.category,
      isRequired: b.is_required,
      isClaimable: b.is_claimable,
      notes: b.notes || '',
    })),
    scheduleBlocks: blocks.map((b) => ({
      id: b.id,
      title: b.title,
      time: b.time ? b.time.slice(0, 16) : '',
      notes: b.notes || '',
    })),
    guestEmails: [],
    noteToGuests: (e as EventWithDetails & { invite_note?: string | null }).invite_note ?? '',
    capacity: (e as EventWithDetails & { capacity?: number | null }).capacity ?? null,
    isPublic: (e as EventWithDetails & { is_public?: boolean }).is_public ?? false,
  };
}

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateEventForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coHosts, setCoHosts] = useState<{ id: string; user_id: string; email?: string }[]>([]);
  const [prepTasks, setPrepTasks] = useState<{ id: string; title: string; remind_at: string | null; completed_at: string | null }[]>([]);
  const [coHostEmail, setCoHostEmail] = useState('');
  const [addingCoHost, setAddingCoHost] = useState(false);
  const [newPrepTitle, setNewPrepTitle] = useState('');
  const [addingPrep, setAddingPrep] = useState(false);

  const updateForm = useCallback((updates: Partial<CreateEventForm>) => {
    setForm((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  useEffect(() => {
    if (!id || !user) return;
    if (id === '__demo__') {
      setError(Copy.event.demoCannotEdit);
      setLoading(false);
      return;
    }
    const fetch = async () => {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      if (eventError || !eventData) {
        setError(Copy.event.notFound);
        setLoading(false);
        return;
      }
      const e = eventData as EventWithDetails & { host_user_id: string };
      const isHost = e.host_user_id === user.id;
      const { data: coHosts } = await supabase.from('event_co_hosts').select('user_id').eq('event_id', id);
      const coHostIds = (coHosts ?? []).map((c: { user_id: string }) => c.user_id);
      const isCoHost = coHostIds.includes(user.id);
      if (!isHost && !isCoHost) {
        setError(Copy.event.onlyHostCanEdit);
        setLoading(false);
        return;
      }
      const [{ data: sections }, { data: items }, { data: bring }, { data: blocks }] = await Promise.all([
        supabase.from('menu_sections').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('menu_items').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('bring_items').select('*').eq('event_id', id).order('sort_order'),
        supabase.from('schedule_blocks').select('*').eq('event_id', id).order('sort_order'),
      ]);
      const sectionMap = new Map<string, MenuSection & { menu_items: MenuItemRow[] }>();
      (sections ?? []).forEach((s: MenuSection) => sectionMap.set(s.id, { ...s, menu_items: [] }));
      (items ?? []).forEach((item: MenuItemRow) => {
        const sec = sectionMap.get(item.section_id);
        if (sec) sec.menu_items.push(item);
      });
      const sectionsList = Array.from(sectionMap.values()).sort((a, b) => a.sort_order - b.sort_order);
      setForm(
        formFromEvent(
          eventData as EventWithDetails,
          sectionsList,
          (bring ?? []) as BringItemRow[],
          (blocks ?? []) as ScheduleBlockRow[]
        )
      );
      const [{ data: coHostsData }, { data: prepData }] = await Promise.all([
        supabase.from('event_co_hosts').select('id, user_id').eq('event_id', id),
        supabase.from('event_prep_tasks').select('id, title, remind_at, completed_at').eq('event_id', id).order('sort_order'),
      ]);
      const coHostRows = (coHostsData ?? []) as { id: string; user_id: string }[];
      const profiles = await Promise.all(coHostRows.map((c) => supabase.from('profiles').select('name').eq('id', c.user_id).single()));
      setCoHosts(coHostRows.map((c, i) => ({ ...c, email: (profiles[i]?.data as { name?: string } | null)?.name ?? c.user_id.slice(0, 8) })));
      setPrepTasks((prepData ?? []) as { id: string; title: string; remind_at: string | null; completed_at: string | null }[]);
      setLoading(false);
    };
    fetch();
  }, [id, user?.id]);

  const handleSubmit = async () => {
    if (!form || !id || !user) return;
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
      await supabase
        .from('events')
        .update({
          title: form.title,
          description: form.description || null,
          start_time: form.startTime,
          bell_time: form.bellTime,
          bell_sound: form.bellSound || 'triangle',
          end_time: form.endTime || null,
          timezone: form.timezone,
          address_line1: form.addressLine1 || 'TBD',
          address_line2: form.addressLine2 || null,
          city: form.city || '',
          state: form.state || '',
          postal_code: form.postalCode || '',
          country: form.country || '',
          location_name: form.locationName || null,
          location_notes: form.locationNotes || null,
          capacity: form.capacity ?? null,
          is_public: form.isPublic ?? false,
        })
        .eq('id', id);

      await supabase.from('menu_sections').delete().eq('event_id', id);
      for (let i = 0; i < form.menuSections.length; i++) {
        const sec = form.menuSections[i];
        const { data: sectionData } = await supabase
          .from('menu_sections')
          .insert({ event_id: id, title: sec.title, sort_order: i })
          .select('id')
          .single();
        if (sectionData) {
          for (let j = 0; j < sec.items.length; j++) {
            await supabase.from('menu_items').insert({
              event_id: id,
              section_id: sectionData.id,
              name: sec.items[j].name,
              notes: sec.items[j].notes || null,
              dietary_tags: sec.items[j].dietaryTags?.length ? sec.items[j].dietaryTags : null,
              sort_order: j,
            });
          }
        }
      }

      await supabase.from('bring_items').delete().eq('event_id', id);
      for (let i = 0; i < form.bringItems.length; i++) {
        const item = form.bringItems[i];
        await supabase.from('bring_items').insert({
          event_id: id,
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

      await supabase.from('schedule_blocks').delete().eq('event_id', id);
      for (let i = 0; i < form.scheduleBlocks.length; i++) {
        const block = form.scheduleBlocks[i];
        await supabase.from('schedule_blocks').insert({
          event_id: id,
          title: block.title,
          time: block.time || null,
          notes: block.notes || null,
          sort_order: i,
        });
      }

      await rescheduleNotificationsForEvent(id, form.bellTime, true);
      trackEventEdited(id);
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      router.replace(`/event/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : Copy.validation.genericError);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.skeletonWrap}>
        <SkeletonCardList count={2} />
      </View>
    );
  }
  if (!form) return <Text style={[styles.centered, { color: colors.textSecondary }]}>{error ?? 'Not found'}</Text>;

  return (
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.stepTitle} accessibilityRole="header">{STEPS[step]}</Text>

      {step === 0 && (
        <>
          <FloatingLabelInput label="Title" value={form.title} onChangeText={(t: string) => updateForm({ title: t })} onClear={() => updateForm({ title: '' })} returnKeyType="next" autoCapitalize="sentences" style={{ marginBottom: spacing.lg }} />
          <FloatingLabelInput label="Start time" value={form.startTime} onChangeText={(t: string) => updateForm({ startTime: t })} onClear={() => updateForm({ startTime: '' })} returnKeyType="next" style={{ marginBottom: spacing.lg }} />
          <FloatingLabelInput label="Bell time" value={form.bellTime} onChangeText={(t: string) => updateForm({ bellTime: t })} onClear={() => updateForm({ bellTime: '' })} returnKeyType="next" style={{ marginBottom: spacing.lg }} />
          <Text style={styles.label}>Bell sound</Text>
          <View style={styles.bellSoundRow}>
            {(['triangle', 'chime', 'gong'] as const).map((sound) => (
              <Pressable
                key={sound}
                accessibilityRole="button"
                accessibilityLabel={`Select ${sound} bell sound`}
                style={[styles.bellSoundBtn, { borderColor: form.bellSound === sound ? colors.primaryButton : colors.border }, form.bellSound === sound && { backgroundColor: colors.primaryButton }]}
                onPress={() => updateForm({ bellSound: sound })}
              >
                <Text style={[styles.bellSoundBtnText, form.bellSound === sound && { color: colors.primaryButtonText }]}>
                  {sound === 'triangle' ? 'Triangle' : sound === 'chime' ? 'Chime' : 'Gong'}
                </Text>
              </Pressable>
            ))}
          </View>
          <FloatingLabelInput
            label="Capacity (optional)"
            value={form.capacity != null ? String(form.capacity) : ''}
            onChangeText={(t: string) => updateForm({ capacity: t === '' ? null : parseInt(t, 10) || null })}
            onClear={() => updateForm({ capacity: null })}
            keyboardType="number-pad"
            returnKeyType="next"
            style={{ marginBottom: spacing.lg }}
          />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>List in Discover (public event)</Text>
            <Switch value={form.isPublic ?? false} onValueChange={(v) => updateForm({ isPublic: v })} trackColor={{ false: colors.inputBorder, true: colors.primaryButton }} thumbColor={colors.primaryButtonText} />
          </View>
        </>
      )}

      {step === 1 && (
        <>
          <FloatingLabelInput label="Address line 1" value={form.addressLine1} onChangeText={(t: string) => updateForm({ addressLine1: t })} onClear={() => updateForm({ addressLine1: '' })} returnKeyType="next" autoComplete="street-address" autoCapitalize="words" style={{ marginBottom: spacing.lg }} />
          <FloatingLabelInput label="Unit / Apt" value={form.addressLine2} onChangeText={(t: string) => updateForm({ addressLine2: t })} onClear={() => updateForm({ addressLine2: '' })} returnKeyType="next" autoCapitalize="words" style={{ marginBottom: spacing.lg }} />
          <FloatingLabelInput label="City" value={form.city} onChangeText={(t: string) => updateForm({ city: t })} onClear={() => updateForm({ city: '' })} returnKeyType="next" autoCapitalize="words" style={{ marginBottom: spacing.lg }} />
          <FloatingLabelInput label="State" value={form.state} onChangeText={(t: string) => updateForm({ state: t })} onClear={() => updateForm({ state: '' })} returnKeyType="next" autoCapitalize="characters" style={{ marginBottom: spacing.lg }} />
          <FloatingLabelInput label="Postal code" value={form.postalCode} onChangeText={(t: string) => updateForm({ postalCode: t })} onClear={() => updateForm({ postalCode: '' })} returnKeyType="next" autoComplete="postal-code" style={{ marginBottom: spacing.lg }} />
          <FloatingLabelInput label="Country" value={form.country} onChangeText={(t: string) => updateForm({ country: t })} onClear={() => updateForm({ country: '' })} returnKeyType="next" autoCapitalize="words" style={{ marginBottom: spacing.lg }} />
          <FloatingLabelInput label="Location notes (parking, gate code)" value={form.locationNotes} onChangeText={(t: string) => updateForm({ locationNotes: t })} onClear={() => updateForm({ locationNotes: '' })} multiline returnKeyType="done" style={{ marginBottom: spacing.lg, minHeight: 80 }} />
        </>
      )}

      {step === 2 && (
        <>
          {form.menuSections.map((sec, si) => (
            <View key={sec.id} style={styles.section}>
              <FloatingLabelInput
                label="Section title"
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
                <FloatingLabelInput
                  key={item.id}
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
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add menu item"
                onPress={() => {
                  const next = [...form.menuSections];
                  next[si] = { ...next[si], items: [...next[si].items, { id: generateId(), name: '', notes: '', dietaryTags: [] }] };
                  updateForm({ menuSections: next });
                }}
              >
                <Text style={[styles.link, { color: colors.tint }]}>+ Add item</Text>
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Add menu section" onPress={() => updateForm({ menuSections: [...form.menuSections, { id: generateId(), title: 'New section', items: [] }] })}>
            <Text style={[styles.link, { color: colors.tint }]}>+ Add section</Text>
          </Pressable>
        </>
      )}

      {step === 3 && (
        <>
          {form.bringItems.map((item, ii) => (
            <View key={item.id} style={styles.bringRow}>
              <FloatingLabelInput label={Copy.placeholder.itemName} value={item.name} onChangeText={(t: string) => { const next = [...form.bringItems]; next[ii] = { ...next[ii], name: t }; updateForm({ bringItems: next }); }} onClear={() => { const next = [...form.bringItems]; next[ii] = { ...next[ii], name: '' }; updateForm({ bringItems: next }); }} returnKeyType="next" autoCapitalize="sentences" style={{ flex: 1, marginBottom: spacing.lg }} />
              <FloatingLabelInput label={Copy.placeholder.quantity} value={item.quantity} onChangeText={(t: string) => { const next = [...form.bringItems]; next[ii] = { ...next[ii], quantity: t }; updateForm({ bringItems: next }); }} onClear={() => { const next = [...form.bringItems]; next[ii] = { ...next[ii], quantity: '' }; updateForm({ bringItems: next }); }} returnKeyType="done" style={{ width: 80, marginBottom: spacing.lg }} />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add bring item"
            onPress={() =>
              updateForm({
                bringItems: [...form.bringItems, { id: generateId(), name: '', quantity: '1', category: 'other', isRequired: false, isClaimable: true, notes: '' }],
              })
            }
          >
            <Text style={[styles.link, { color: colors.tint }]}>+ Add bring item</Text>
          </Pressable>
        </>
      )}

      {step === 4 && (
        <>
          {form.scheduleBlocks.map((block, i) => (
            <View key={block.id} style={styles.row}>
              <FloatingLabelInput label={Copy.placeholder.scheduleTitle} value={block.title} onChangeText={(t: string) => { const next = [...form.scheduleBlocks]; next[i] = { ...next[i], title: t }; updateForm({ scheduleBlocks: next }); }} onClear={() => { const next = [...form.scheduleBlocks]; next[i] = { ...next[i], title: '' }; updateForm({ scheduleBlocks: next }); }} returnKeyType="next" autoCapitalize="sentences" style={{ marginBottom: spacing.lg }} />
              <FloatingLabelInput label={Copy.placeholder.scheduleTime} value={block.time} onChangeText={(t: string) => { const next = [...form.scheduleBlocks]; next[i] = { ...next[i], time: t }; updateForm({ scheduleBlocks: next }); }} onClear={() => { const next = [...form.scheduleBlocks]; next[i] = { ...next[i], time: '' }; updateForm({ scheduleBlocks: next }); }} returnKeyType="done" style={{ marginBottom: spacing.lg }} />
            </View>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Add schedule block" onPress={() => updateForm({ scheduleBlocks: [...form.scheduleBlocks, { id: generateId(), title: '', time: '', notes: '' }] })}>
            <Text style={[styles.link, { color: colors.tint }]}>+ Add schedule block</Text>
          </Pressable>
        </>
      )}

      {step === 5 && (
        <>
          <Text style={styles.label}>Co-hosts (can edit menu, bring list, ring bell)</Text>
          {coHosts.map((c) => (
            <View key={c.id} style={styles.coHostRow}>
              <Text style={styles.coHostText}>{c.email ?? c.user_id}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove co-host ${c.email ?? c.user_id}`}
                onPress={async () => {
                  await supabase.from('event_co_hosts').delete().eq('id', c.id);
                  setCoHosts((prev) => prev.filter((x) => x.id !== c.id));
                }}
              >
                <Text style={[styles.removeText, { color: colors.error }]}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.addRow}>
            <FloatingLabelInput
              label={Copy.placeholder.coHostEmail}
              value={coHostEmail}
              onChangeText={setCoHostEmail}
              onClear={() => setCoHostEmail('')}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              autoComplete="email"
              style={{ flex: 1 }}
            />
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Add co-host"
              style={[styles.addBtn, { backgroundColor: colors.primaryButton }]}
              disabled={addingCoHost || !coHostEmail.trim()}
              onPress={async () => {
                setAddingCoHost(true);
                const { data: userId, error: rpcErr } = await supabase.rpc('get_user_id_by_email', { p_email: coHostEmail.trim() });
                if (rpcErr || !userId) {
                  setError('No account found for that email.');
                  setAddingCoHost(false);
                  return;
                }
                const { data: inserted, error: insertErr } = await supabase.from('event_co_hosts').insert({ event_id: id!, user_id: userId }).select('id, user_id').single();
                setAddingCoHost(false);
                if (insertErr) {
                  setError(insertErr.message.includes('duplicate') ? 'Already a co-host' : insertErr.message);
                  return;
                }
                setCoHosts((prev) => [...prev, { id: inserted.id, user_id: inserted.user_id, email: coHostEmail.trim() }]);
                setCoHostEmail('');
                setError(null);
              }}
            >
              <Text style={[styles.addBtnText, { color: colors.primaryButtonText }]}>Add</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.label}>Prep checklist (private to host/co-hosts)</Text>
          {prepTasks.map((t) => (
            <View key={t.id} style={styles.prepRow}>
              <Text style={t.completed_at ? styles.prepTitleDone : styles.prepTitle}>{t.title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Mark ${t.title} as ${t.completed_at ? 'not done' : 'done'}`}
                onPress={async () => {
                  await supabase.from('event_prep_tasks').update({ completed_at: t.completed_at ? null : new Date().toISOString() }).eq('id', t.id);
                  setPrepTasks((prev) => prev.map((p) => (p.id === t.id ? { ...p, completed_at: p.completed_at ? null : new Date().toISOString() } : p)));
                }}
              >
                <Text style={[styles.smallBtnText, { color: colors.tint }]}>{t.completed_at ? 'Undo' : 'Done'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove prep task ${t.title}`}
                onPress={async () => { await supabase.from('event_prep_tasks').delete().eq('id', t.id); setPrepTasks((prev) => prev.filter((x) => x.id !== t.id)); }}
              >
                <Text style={[styles.removeText, { color: colors.error }]}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.addRow}>
            <FloatingLabelInput
              label={Copy.placeholder.prepTask}
              value={newPrepTitle}
              onChangeText={setNewPrepTitle}
              onClear={() => setNewPrepTitle('')}
              returnKeyType="done"
              autoCapitalize="sentences"
              style={{ flex: 1 }}
            />
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Add prep task"
              style={[styles.addBtn, { backgroundColor: colors.primaryButton }]}
              disabled={addingPrep || !newPrepTitle.trim()}
              onPress={async () => {
                setAddingPrep(true);
                await supabase.from('event_prep_tasks').insert({ event_id: id!, title: newPrepTitle.trim(), sort_order: prepTasks.length });
                const { data: list } = await supabase.from('event_prep_tasks').select('id, title, remind_at, completed_at').eq('event_id', id!).order('sort_order');
                setPrepTasks((list ?? []) as typeof prepTasks);
                setNewPrepTitle('');
                setAddingPrep(false);
              }}
            >
              <Text style={[styles.addBtnText, { color: colors.primaryButtonText }]}>Add</Text>
            </AnimatedPressable>
          </View>
        </>
      )}

      {step === 6 && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{form.title}</Text>
          <Text style={styles.summaryText}>Bell: {form.bellTime}</Text>
          <Text style={styles.summaryText}>{form.addressLine1}, {form.city}</Text>
          {form.capacity != null ? <Text style={styles.summaryText}>Capacity: {form.capacity}</Text> : null}
        </View>
      )}

      {error ? (
        <Card style={{ marginBottom: spacing.md }}>
          <CardBody style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ color: colors.error, fontSize: typography.body }}>!</Text>
            <Text style={[styles.error, { color: colors.error, marginBottom: 0, flex: 1 }]}>{error}</Text>
          </CardBody>
        </Card>
      ) : null}

      <View style={styles.footer}>
        {step > 0 && (
          <AnimatedPressable variant="secondary" enableHaptics accessibilityRole="button" accessibilityLabel="Previous step" style={[styles.btnSecondary, { borderWidth: 1, borderColor: colors.inputBorder }]} onPress={() => setStep(step - 1)}>
            <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Back</Text>
          </AnimatedPressable>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <AnimatedPressable variant="primary" enableHaptics accessibilityRole="button" accessibilityLabel="Next step" style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }]} onPress={() => setStep(step + 1)}>
            <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>Next</Text>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable variant="primary" enableHaptics accessibilityRole="button" accessibilityLabel="Save event changes" style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
            <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>{saving ? Copy.common.saving : Copy.event.saveChanges}</Text>
          </AnimatedPressable>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + spacing.sm },
  skeletonWrap: { flex: 1, padding: spacing.lg, paddingTop: spacing.xxl },
  centered: { flex: 1, textAlign: 'center', marginTop: spacing.xxl },
  stepTitle: { fontSize: typography.headline, fontWeight: '600', marginBottom: spacing.lg },
  label: { fontSize: typography.meta, fontWeight: '500', marginBottom: spacing.xs + 2 },
  bellSoundRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  bellSoundBtn: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, borderRadius: radius.input, borderWidth: 1 },
  bellSoundBtnText: { fontSize: typography.meta, fontWeight: '500' },
  section: { marginBottom: spacing.lg },
  row: { marginBottom: spacing.sm },
  bringRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  link: { fontSize: typography.body, marginTop: spacing.sm },
  summary: { marginBottom: spacing.xl },
  summaryTitle: { fontSize: typography.h3, fontWeight: '600', marginBottom: spacing.sm },
  summaryText: { fontSize: typography.meta, marginBottom: spacing.xs },
  error: { marginBottom: spacing.md },
  footer: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  btnPrimary: { flex: 1, padding: spacing.lg, borderRadius: radius.input, alignItems: 'center' },
  btnPrimaryText: { fontWeight: '600' },
  btnSecondary: { padding: spacing.lg, borderRadius: radius.input, alignItems: 'center' },
  btnSecondaryText: { fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  coHostRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  coHostText: { fontSize: typography.body, flex: 1 },
  removeText: { fontSize: typography.meta, fontWeight: '500' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  addBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg + spacing.xs, borderRadius: radius.input },
  addBtnText: { fontWeight: '600' },
  prepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  prepTitle: { fontSize: typography.body, flex: 1 },
  prepTitleDone: { fontSize: typography.body, flex: 1, textDecorationLine: 'line-through', opacity: 0.7 },
  smallBtnText: { fontSize: typography.meta, fontWeight: '500' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  toggleLabel: { fontSize: typography.meta, flex: 1 },
});

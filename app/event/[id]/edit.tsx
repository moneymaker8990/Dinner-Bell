import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import type { CreateEventForm } from '@/lib/eventForm';
import { generateId } from '@/lib/eventForm';
import { rescheduleNotificationsForEvent } from '@/lib/rescheduleNotifications';
import { supabase } from '@/lib/supabase';
import type { BringItemRow, EventWithDetails, MenuItemRow, MenuSection, ScheduleBlockRow } from '@/types/events';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';

const STEPS = ['Basics', 'Location', 'Menu', 'Bring List', 'Schedule', 'Host tools', 'Review'];
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

  const inputStyle = [styles.input, { borderColor: colors.inputBorder }];

  const updateForm = useCallback((updates: Partial<CreateEventForm>) => {
    setForm((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  useEffect(() => {
    if (!id || !user) return;
    if (id === '__demo__') {
      setError("Demo events can't be edited.");
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
        setError('Event not found');
        setLoading(false);
        return;
      }
      const e = eventData as EventWithDetails & { host_user_id: string };
      const isHost = e.host_user_id === user.id;
      const { data: coHosts } = await supabase.from('event_co_hosts').select('user_id').eq('event_id', id);
      const coHostIds = (coHosts ?? []).map((c: { user_id: string }) => c.user_id);
      const isCoHost = coHostIds.includes(user.id);
      if (!isHost && !isCoHost) {
        setError('Only the host or co-hosts can edit this event.');
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
    try {
      await (supabase as any)
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

      await (supabase as any).from('menu_sections').delete().eq('event_id', id);
      for (let i = 0; i < form.menuSections.length; i++) {
        const sec = form.menuSections[i];
        const { data: sectionData } = await (supabase as any)
          .from('menu_sections')
          .insert({ event_id: id, title: sec.title, sort_order: i })
          .select('id')
          .single();
        if (sectionData) {
          for (let j = 0; j < sec.items.length; j++) {
            await (supabase as any).from('menu_items').insert({
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

      await (supabase as any).from('bring_items').delete().eq('event_id', id);
      for (let i = 0; i < form.bringItems.length; i++) {
        const item = form.bringItems[i];
        await (supabase as any).from('bring_items').insert({
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

      await (supabase as any).from('schedule_blocks').delete().eq('event_id', id);
      for (let i = 0; i < form.scheduleBlocks.length; i++) {
        const block = form.scheduleBlocks[i];
        await (supabase as any).from('schedule_blocks').insert({
          event_id: id,
          title: block.title,
          time: block.time || null,
          notes: block.notes || null,
          sort_order: i,
        });
      }

      await rescheduleNotificationsForEvent(id, form.bellTime, true);
      router.replace(`/event/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <Text style={styles.centered}>{loading ? 'Loading...' : error ?? 'Not found'}</Text>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.stepTitle}>{STEPS[step]}</Text>

      {step === 0 && (
        <>
          <Text style={styles.label}>Title</Text>
          <TextInput style={inputStyle} value={form.title} onChangeText={(t: string) => updateForm({ title: t })} placeholder="Event title" placeholderTextColor="#888" />
          <Text style={styles.label}>Start time</Text>
          <TextInput style={inputStyle} value={form.startTime} onChangeText={(t: string) => updateForm({ startTime: t })} placeholder="YYYY-MM-DDTHH:mm" placeholderTextColor="#888" />
          <Text style={styles.label}>Bell time</Text>
          <TextInput style={inputStyle} value={form.bellTime} onChangeText={(t: string) => updateForm({ bellTime: t })} placeholder="YYYY-MM-DDTHH:mm" placeholderTextColor="#888" />
          <Text style={styles.label}>Bell sound</Text>
          <View style={styles.bellSoundRow}>
            {(['triangle', 'chime', 'gong'] as const).map((sound) => (
              <Pressable
                key={sound}
                style={[styles.bellSoundBtn, form.bellSound === sound && { backgroundColor: colors.primaryButton, borderColor: colors.primaryButton }]}
                onPress={() => updateForm({ bellSound: sound })}
              >
                <Text style={[styles.bellSoundBtnText, form.bellSound === sound && { color: colors.primaryButtonText }]}>
                  {sound === 'triangle' ? 'Triangle' : sound === 'chime' ? 'Chime' : 'Gong'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Capacity (optional max guests, leave empty for no limit)</Text>
          <TextInput
            style={inputStyle}
            value={form.capacity != null ? String(form.capacity) : ''}
            onChangeText={(t: string) => updateForm({ capacity: t === '' ? null : parseInt(t, 10) || null })}
            placeholder="e.g. 12"
            placeholderTextColor="#888"
            keyboardType="number-pad"
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
          <TextInput style={inputStyle} value={form.addressLine1} onChangeText={(t: string) => updateForm({ addressLine1: t })} placeholder="Street" placeholderTextColor="#888" />
          <Text style={styles.label}>Unit / Apt</Text>
          <TextInput style={inputStyle} value={form.addressLine2} onChangeText={(t: string) => updateForm({ addressLine2: t })} placeholder="Optional" placeholderTextColor="#888" />
          <Text style={styles.label}>City, State, Postal code, Country</Text>
          <TextInput style={inputStyle} value={form.city} onChangeText={(t: string) => updateForm({ city: t })} placeholder="City" placeholderTextColor="#888" />
          <TextInput style={inputStyle} value={form.state} onChangeText={(t: string) => updateForm({ state: t })} placeholder="State" placeholderTextColor="#888" />
          <TextInput style={inputStyle} value={form.postalCode} onChangeText={(t: string) => updateForm({ postalCode: t })} placeholder="Postal code" placeholderTextColor="#888" />
          <TextInput style={inputStyle} value={form.country} onChangeText={(t: string) => updateForm({ country: t })} placeholder="Country" placeholderTextColor="#888" />
          <Text style={styles.label}>Location notes (parking, gate code)</Text>
          <TextInput style={[inputStyle, styles.textArea]} value={form.locationNotes} onChangeText={(t: string) => updateForm({ locationNotes: t })} placeholder="Optional" placeholderTextColor="#888" multiline />
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
                placeholder="e.g. Main"
                placeholderTextColor="#888"
              />
              {sec.items.map((item, ii) => (
                <TextInput
                  key={item.id}
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
              ))}
              <Pressable
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
          <Pressable onPress={() => updateForm({ menuSections: [...form.menuSections, { id: generateId(), title: 'New section', items: [] }] })}>
            <Text style={[styles.link, { color: colors.tint }]}>+ Add section</Text>
          </Pressable>
        </>
      )}

      {step === 3 && (
        <>
          {form.bringItems.map((item, ii) => (
            <View key={item.id} style={styles.bringRow}>
              <TextInput style={[inputStyle, { flex: 1 }]} value={item.name} onChangeText={(t: string) => { const next = [...form.bringItems]; next[ii] = { ...next[ii], name: t }; updateForm({ bringItems: next }); }} placeholder="Item" placeholderTextColor="#888" />
              <TextInput style={[inputStyle, { width: 80 }]} value={item.quantity} onChangeText={(t: string) => { const next = [...form.bringItems]; next[ii] = { ...next[ii], quantity: t }; updateForm({ bringItems: next }); }} placeholder="Qty" placeholderTextColor="#888" />
            </View>
          ))}
          <Pressable
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
              <TextInput style={inputStyle} value={block.title} onChangeText={(t: string) => { const next = [...form.scheduleBlocks]; next[i] = { ...next[i], title: t }; updateForm({ scheduleBlocks: next }); }} placeholder="Title" placeholderTextColor="#888" />
              <TextInput style={inputStyle} value={block.time} onChangeText={(t: string) => { const next = [...form.scheduleBlocks]; next[i] = { ...next[i], time: t }; updateForm({ scheduleBlocks: next }); }} placeholder="Time (optional)" placeholderTextColor="#888" />
            </View>
          ))}
          <Pressable onPress={() => updateForm({ scheduleBlocks: [...form.scheduleBlocks, { id: generateId(), title: '', time: '', notes: '' }] })}>
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
                onPress={async () => {
                  await supabase.from('event_co_hosts').delete().eq('id', c.id);
                  setCoHosts((prev) => prev.filter((x) => x.id !== c.id));
                }}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              style={[inputStyle, { flex: 1 }]}
              value={coHostEmail}
              onChangeText={setCoHostEmail}
              placeholder="Co-host email"
              placeholderTextColor="#888"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Pressable
              style={[styles.addBtn, { backgroundColor: colors.primaryButton }]}
              disabled={addingCoHost || !coHostEmail.trim()}
              onPress={async () => {
                setAddingCoHost(true);
                const { data: userId, error: rpcErr } = await (supabase as any).rpc('get_user_id_by_email', { p_email: coHostEmail.trim() });
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
            </Pressable>
          </View>
          <Text style={styles.label}>Prep checklist (private to host/co-hosts)</Text>
          {prepTasks.map((t) => (
            <View key={t.id} style={styles.prepRow}>
              <Text style={t.completed_at ? styles.prepTitleDone : styles.prepTitle}>{t.title}</Text>
              <Pressable
                onPress={async () => {
                  await supabase.from('event_prep_tasks').update({ completed_at: t.completed_at ? null : new Date().toISOString() }).eq('id', t.id);
                  setPrepTasks((prev) => prev.map((p) => (p.id === t.id ? { ...p, completed_at: p.completed_at ? null : new Date().toISOString() } : p)));
                }}
              >
                <Text style={[styles.smallBtnText, { color: colors.tint }]}>{t.completed_at ? 'Undo' : 'Done'}</Text>
              </Pressable>
              <Pressable onPress={async () => { await supabase.from('event_prep_tasks').delete().eq('id', t.id); setPrepTasks((prev) => prev.filter((x) => x.id !== t.id)); }}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              style={[inputStyle, { flex: 1 }]}
              value={newPrepTitle}
              onChangeText={setNewPrepTitle}
              placeholder="e.g. Preheat oven"
              placeholderTextColor="#888"
            />
            <Pressable
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
            </Pressable>
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.footer}>
        {step > 0 && (
          <Pressable style={[styles.btnSecondary, { borderWidth: 1, borderColor: colors.inputBorder }]} onPress={() => setStep(step - 1)}>
            <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Back</Text>
          </Pressable>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <Pressable style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }]} onPress={() => setStep(step + 1)}>
            <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>Next</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.btnPrimary, { backgroundColor: colors.primaryButton }, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
            <Text style={[styles.btnPrimaryText, { color: colors.primaryButtonText }]}>{saving ? 'Saving...' : 'Save changes'}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, textAlign: 'center', marginTop: 40 },
  stepTitle: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  bellSoundRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  bellSoundBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ccc' },
  bellSoundBtnText: { fontSize: 14, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  textArea: { minHeight: 80 },
  section: { marginBottom: 16 },
  row: { marginBottom: 8 },
  bringRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  link: { fontSize: 16, marginTop: 8 },
  summary: { marginBottom: 24 },
  summaryTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  summaryText: { fontSize: 14, marginBottom: 4 },
  error: { color: '#c00', marginBottom: 12 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btnPrimary: { flex: 1, padding: 16, borderRadius: 8, alignItems: 'center' },
  btnPrimaryText: { fontWeight: '600' },
  btnSecondary: { padding: 16, borderRadius: 8, alignItems: 'center' },
  btnSecondaryText: { fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  coHostRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  coHostText: { fontSize: 16, flex: 1 },
  removeText: { fontSize: 14, color: '#c00', fontWeight: '500' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  addBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  addBtnText: { fontWeight: '600' },
  prepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  prepTitle: { fontSize: 16, flex: 1 },
  prepTitleDone: { fontSize: 16, flex: 1, textDecorationLine: 'line-through', opacity: 0.7 },
  smallBtnText: { fontSize: 14, fontWeight: '500' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggleLabel: { fontSize: 14, flex: 1 },
});

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
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

const STEPS = ['Basics', 'Location', 'Menu', 'Bring List', 'Schedule', 'Review'];
const TOTAL_STEPS = 6;

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
        .eq('host_user_id', user.id)
        .single();
      if (eventError || !eventData) {
        setError('Event not found');
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
        })
        .eq('id', id)
        .eq('host_user_id', user.id);

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
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{form.title}</Text>
          <Text style={styles.summaryText}>Bell: {form.bellTime}</Text>
          <Text style={styles.summaryText}>{form.addressLine1}, {form.city}</Text>
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
});

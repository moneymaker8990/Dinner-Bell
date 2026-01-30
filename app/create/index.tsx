import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { defaultForm, generateId, type CreateEventForm } from '@/lib/eventForm';
import { supabase } from '@/lib/supabase';
import type { BringItemCategory } from '@/types/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';

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
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateEventForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showBellPicker, setShowBellPicker] = useState(false);
  const hasNavigatedRef = useRef(false);

  const updateForm = useCallback((updates: Partial<CreateEventForm>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

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
      const { data: eventData, error: eventError } = await (supabase as any)
        .from('events')
        .insert({
          host_user_id: user.id,
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
          invite_note: form.noteToGuests || null,
          invite_token: inviteToken,
          is_cancelled: false,
        })
        .select('id')
        .single();

      if (eventError || !eventData) {
        setError(eventError?.message ?? 'Failed to create event');
        setSaving(false);
        return;
      }

      const eventId = eventData.id;

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.stepTitle}>{STEPS[step]}</Text>

      {step === 0 && (
        <>
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
          <Text style={styles.label}>Guest emails (one per line or comma-separated)</Text>
          <TextInput
            style={[inputStyle, styles.textArea]}
            value={form.guestEmails.join(', ')}
            onChangeText={(t: string) => updateForm({ guestEmails: t.split(/[\n,]/).map((e: string) => e.trim()).filter(Boolean) })}
            placeholder="email@example.com"
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
});

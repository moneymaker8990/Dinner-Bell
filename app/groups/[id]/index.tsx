import { SkeletonCardList } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { radius, spacing, typography } from '@/constants/Theme';
import { trackGroupDeleted, trackGroupMemberAdded } from '@/lib/analytics';
import { addMemberToGroup, deleteGroup, getGroup, getGroupMembers, removeMemberFromGroup, type GuestGroupMember } from '@/lib/groups';
import { type Href, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { Alert, Pressable, StyleSheet } from 'react-native';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [groupName, setGroupName] = useState<string | null>(null);
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [members, setMembers] = useState<GuestGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactValue, setContactValue] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [list, group] = await Promise.all([getGroupMembers(id), getGroup(id)]);
      setMembers(list);
      if (group) setGroupName(group.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : Copy.validation.genericError);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: groupName ?? Copy.groups.fallbackGroupTitle });
  }, [groupName, navigation]);

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(Copy.groups.deleteGroupTitle, Copy.groups.deleteGroupBody, [
      { text: Copy.common.cancel, style: 'cancel' },
      { text: Copy.groups.delete, style: 'destructive', onPress: async () => {
        const ok = await deleteGroup(id);
        if (ok) {
          trackGroupDeleted(id);
          router.replace('/groups' as Href);
        }
      } },
    ]);
  };

  const handleAdd = async () => {
    if (!id || !contactValue.trim()) return;
    setAdding(true);
    const ok = await addMemberToGroup(id, contactType, contactValue.trim(), displayName.trim() || undefined);
    setAdding(false);
    if (ok) {
      trackGroupMemberAdded(id);
      setContactValue('');
      setDisplayName('');
      load();
    }
  };

  const handleRemove = async (memberId: string) => {
    await removeMemberFromGroup(memberId);
    load();
  };

  if (!id) return <Text style={[styles.centered, { color: colors.textSecondary }]}>{Copy.groups.invalidGroup}</Text>;
  if (loading) {
    return (
      <View style={styles.skeletonWrap}>
        <SkeletonCardList count={2} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorWrap}>
        <Text style={[styles.body, { color: colors.warn }]}>{error}</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{Copy.groups.addMember}</Text>
      <Text style={styles.label}>{Copy.groups.contactType}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.chip, contactType === 'email' && { backgroundColor: colors.primaryButton }]}
          onPress={() => setContactType('email')}
          accessibilityRole="button"
          accessibilityLabel={Copy.groups.email}
        >
          <Text style={[styles.chipText, contactType === 'email' && { color: colors.primaryButtonText }]}>{Copy.groups.email}</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, contactType === 'phone' && { backgroundColor: colors.primaryButton }]}
          onPress={() => setContactType('phone')}
          accessibilityRole="button"
          accessibilityLabel={Copy.groups.phone}
        >
          <Text style={[styles.chipText, contactType === 'phone' && { color: colors.primaryButtonText }]}>{Copy.groups.phone}</Text>
        </Pressable>
      </View>
      <FloatingLabelInput
        label={contactType === 'email' ? Copy.groups.email : Copy.groups.phone}
        value={contactValue}
        onChangeText={setContactValue}
        onClear={() => setContactValue('')}
        returnKeyType="next"
        autoCapitalize={contactType === 'email' ? 'none' : undefined}
        keyboardType={contactType === 'email' ? 'email-address' : 'phone-pad'}
        style={{ marginBottom: spacing.md }}
      />
      <FloatingLabelInput
        label="Display name (optional)"
        value={displayName}
        onChangeText={setDisplayName}
        onClear={() => setDisplayName('')}
        returnKeyType="done"
        autoComplete="name"
        autoCapitalize="words"
        style={{ marginBottom: spacing.md }}
      />
      <AnimatedPressable style={[styles.button, { backgroundColor: colors.primaryButton }, adding && styles.buttonDisabled]} onPress={handleAdd} disabled={adding || !contactValue.trim()} accessibilityRole="button" accessibilityLabel={Copy.groups.addMember}>
        <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{adding ? Copy.common.adding : Copy.groups.add}</Text>
      </AnimatedPressable>
      <Text style={styles.sectionTitle}>{Copy.groups.members(members.length)}</Text>
      {members.length === 0 ? (
        <Text style={styles.body}>{Copy.groups.noMembers}</Text>
      ) : (
        members.map((m) => (
          <View key={m.id} style={[styles.memberRow, { borderColor: colors.border }]}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{m.display_name || m.contact_value}</Text>
              <Text style={styles.memberContact}>{m.contact_value}</Text>
            </View>
            <Pressable style={styles.removeBtn} onPress={() => handleRemove(m.id)} accessibilityRole="button" accessibilityLabel={`${Copy.groups.remove} ${m.display_name || m.contact_value}`}>
              <Text style={[styles.removeText, { color: colors.error }]}>{Copy.groups.remove}</Text>
            </Pressable>
          </View>
        ))
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + spacing.sm },
  skeletonWrap: { flex: 1, padding: spacing.lg, paddingTop: spacing.xxl },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  centered: { flex: 1, textAlign: 'center', marginTop: spacing.xxl },
  sectionTitle: { fontSize: typography.h3, fontWeight: '600', marginBottom: spacing.md, marginTop: spacing.xl },
  label: { fontSize: typography.meta, fontWeight: '500', marginBottom: spacing.xs + 2 },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.input, minHeight: 44, justifyContent: 'center' },
  chipText: { fontWeight: '600' },
  button: { padding: spacing.lg, borderRadius: radius.input, alignItems: 'center', marginBottom: spacing.sm },
  buttonText: { fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  body: { fontSize: typography.meta, opacity: 0.85 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.input, borderWidth: 1, marginBottom: spacing.sm },
  memberInfo: { flex: 1 },
  memberName: { fontSize: typography.body, fontWeight: '500' },
  memberContact: { fontSize: typography.microLabel + 1, opacity: 0.8 },
  removeText: { fontSize: typography.meta, fontWeight: '500' },
  removeBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  deleteButton: { marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.input, borderWidth: 1, alignItems: 'center' },
});

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { addMemberToGroup, deleteGroup, getGroup, getGroupMembers, removeMemberFromGroup, type GuestGroupMember } from '@/lib/groups';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [groupName, setGroupName] = useState<string | null>(null);
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [members, setMembers] = useState<GuestGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactValue, setContactValue] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [list, group] = await Promise.all([getGroupMembers(id), getGroup(id)]);
    setMembers(list);
    if (group) setGroupName(group.name);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: groupName ?? 'Group' });
  }, [groupName, navigation]);

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete group', 'Remove this group? Members are not removed from any events.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const ok = await deleteGroup(id);
        if (ok) router.replace('/groups');
      } },
    ]);
  };

  const handleAdd = async () => {
    if (!id || !contactValue.trim()) return;
    setAdding(true);
    const ok = await addMemberToGroup(id, contactType, contactValue.trim(), displayName.trim() || undefined);
    setAdding(false);
    if (ok) {
      setContactValue('');
      setDisplayName('');
      load();
    }
  };

  const handleRemove = async (memberId: string) => {
    await removeMemberFromGroup(memberId);
    load();
  };

  if (!id) return <Text style={styles.centered}>Invalid group</Text>;
  if (loading) return <Text style={styles.centered}>Loading...</Text>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Add member</Text>
      <Text style={styles.label}>Contact type</Text>
      <View style={styles.row}>
        <Pressable style={[styles.chip, contactType === 'email' && { backgroundColor: colors.primaryButton }]} onPress={() => setContactType('email')}>
          <Text style={[styles.chipText, contactType === 'email' && { color: colors.primaryButtonText }]}>Email</Text>
        </Pressable>
        <Pressable style={[styles.chip, contactType === 'phone' && { backgroundColor: colors.primaryButton }]} onPress={() => setContactType('phone')}>
          <Text style={[styles.chipText, contactType === 'phone' && { color: colors.primaryButtonText }]}>Phone</Text>
        </Pressable>
      </View>
      <Text style={styles.label}>{contactType === 'email' ? 'Email' : 'Phone'}</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.inputBorder }]}
        value={contactValue}
        onChangeText={setContactValue}
        placeholder={contactType === 'email' ? 'email@example.com' : '5551234567'}
        placeholderTextColor="#888"
        keyboardType={contactType === 'email' ? 'email-address' : 'phone-pad'}
      />
      <Text style={styles.label}>Display name (optional)</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.inputBorder }]}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Name"
        placeholderTextColor="#888"
      />
      <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }, adding && styles.buttonDisabled]} onPress={handleAdd} disabled={adding || !contactValue.trim()}>
        <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{adding ? 'Adding...' : 'Add'}</Text>
      </Pressable>
      <Text style={styles.sectionTitle}>Members ({members.length})</Text>
      {members.length === 0 ? (
        <Text style={styles.body}>No members yet.</Text>
      ) : (
        members.map((m) => (
          <View key={m.id} style={[styles.memberRow, { borderColor: colors.border }]}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{m.display_name || m.contact_value}</Text>
              <Text style={styles.memberContact}>{m.contact_value}</Text>
            </View>
            <Pressable onPress={() => handleRemove(m.id)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, textAlign: 'center', marginTop: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, marginTop: 24 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  chipText: { fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  button: { padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  buttonText: { fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  body: { fontSize: 14, opacity: 0.85 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '500' },
  memberContact: { fontSize: 13, opacity: 0.8 },
  removeText: { fontSize: 14, color: '#c00', fontWeight: '500' },
  deleteButton: { marginTop: 24, padding: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
});

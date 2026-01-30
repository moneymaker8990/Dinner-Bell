import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { createGroup, fetchGroups, type GuestGroup } from '@/lib/groups';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [groups, setGroups] = useState<GuestGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const list = await fetchGroups();
    setGroups(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user?.id, load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const id = await createGroup(newName.trim());
    setCreating(false);
    if (id) {
      setNewName('');
      load();
      router.push(`/groups/${id}`);
    }
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.body}>Sign in to manage guest groups.</Text>
        <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={() => router.push('/sign-in')}>
          <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) return <Text style={styles.centered}>Loading...</Text>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>New group</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.inputBorder }]}
        value={newName}
        onChangeText={setNewName}
        placeholder="Group name (e.g. Family)"
        placeholderTextColor="#888"
      />
      <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }, creating && styles.buttonDisabled]} onPress={handleCreate} disabled={creating || !newName.trim()}>
        <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{creating ? 'Creating...' : 'Create group'}</Text>
      </Pressable>
      <Text style={styles.sectionTitle}>Your groups</Text>
      {groups.length === 0 ? (
        <Text style={styles.body}>No groups yet. Create one to quickly invite the same people to future events.</Text>
      ) : (
        groups.map((g) => (
          <Pressable key={g.id} style={[styles.groupRow, { borderColor: colors.border }]} onPress={() => router.push(`/groups/${g.id}`)}>
            <Text style={styles.groupName}>{g.name}</Text>
            <Text style={styles.groupArrow}>→</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  button: { padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 24 },
  buttonText: { fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14, opacity: 0.85, marginBottom: 16 },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  groupName: { fontSize: 16, fontWeight: '500' },
  groupArrow: { fontSize: 18, opacity: 0.6 },
});

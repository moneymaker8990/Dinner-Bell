import { AnimatedPressable } from '@/components/AnimatedPressable';
import { EmptyState } from '@/components/EmptyState';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { SkeletonCardList } from '@/components/SkeletonLoader';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, spacing, typography } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateGroup, useGroups } from '@/hooks/useGroups';
import { trackGroupCreated } from '@/lib/analytics';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { data: groups = [], isLoading, error, refetch } = useGroups(user?.id);
  const createGroupMutation = useCreateGroup();
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim() || !user?.id) return;
    try {
      const created = await createGroupMutation.mutateAsync({ userId: user.id, name: newName.trim() });
      trackGroupCreated(created.id);
      setNewName('');
      router.push(`/groups/${created.id}` as Href);
    } catch {
      // mutation error is surfaced via createGroupMutation.error
    }
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.body}>Sign in to manage guest groups.</Text>
        <AnimatedPressable style={[styles.button, { backgroundColor: colors.primaryButton }]} onPress={() => router.push('/sign-in')} accessibilityRole="button" accessibilityLabel="Sign in to manage groups">
          <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>Sign in</Text>
        </AnimatedPressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        <SkeletonCardList count={3} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.body, { color: colors.warn }]}>{error.message}</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FloatingLabelInput
        label="New group"
        value={newName}
        onChangeText={setNewName}
        onClear={() => setNewName('')}
        returnKeyType="done"
        autoCapitalize="words"
        style={{ marginBottom: spacing.md }}
      />
      <AnimatedPressable style={[styles.button, { backgroundColor: colors.primaryButton }, createGroupMutation.isPending && styles.buttonDisabled]} onPress={handleCreate} disabled={createGroupMutation.isPending || !newName.trim()} accessibilityRole="button" accessibilityLabel="Create group">
        <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>{createGroupMutation.isPending ? 'Creating...' : 'Create group'}</Text>
      </AnimatedPressable>
      <Text style={styles.sectionTitle} accessibilityRole="header">Your groups</Text>
      {groups.length === 0 ? (
        <EmptyState
          headline="No groups yet"
          body="Create a group to quickly invite the same people to future events."
          primaryCta={<></>}
        />
      ) : (
        groups.map((g) => (
          <Pressable key={g.id} style={[styles.groupRow, { borderColor: colors.border }]} onPress={() => router.push(`/groups/${g.id}` as Href)} accessibilityRole="button" accessibilityLabel={`Open group ${g.name}`}>
            <Text style={styles.groupName}>{g.name}</Text>
            <Text style={styles.groupArrow}>→</Text>
          </Pressable>
        ))
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + spacing.sm },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  skeletonWrap: { flex: 1, padding: spacing.lg, paddingTop: spacing.xxl },
  button: { padding: spacing.lg, borderRadius: radius.input, alignItems: 'center', marginBottom: spacing.xl },
  buttonText: { fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  sectionTitle: { fontSize: typography.h3, fontWeight: '600', marginBottom: spacing.md },
  body: { fontSize: typography.meta, opacity: 0.85, marginBottom: spacing.lg },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderRadius: radius.input, borderWidth: 1, marginBottom: spacing.sm },
  groupName: { fontSize: typography.body, fontWeight: '500' },
  groupArrow: { fontSize: typography.h3, opacity: 0.6 },
});

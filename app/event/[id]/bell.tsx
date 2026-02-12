import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { DinnerTriangleIcon } from '@/components/DinnerTriangleIcon';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, spacing, typography } from '@/constants/Theme';
import { trackScreenViewed } from '@/lib/analytics';
import { playBellSound } from '@/lib/bellSound';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

export default function BellExperienceScreen() {
  const params = useLocalSearchParams<{ id: string; message?: string }>();
  const id = params.id;
  const messageFromParams = params.message;
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [message, setMessage] = useState<string | null>(messageFromParams ?? null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    trackScreenViewed('RingBell');
  }, []);

  useEffect(() => {
    if (messageFromParams) setMessage(messageFromParams);
  }, [messageFromParams]);

  useEffect(() => {
    if (played) return;
    setPlayed(true);
    playBellSound();
  }, [played]);

  const handleDismiss = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.bellBox}>
        <DinnerTriangleIcon size={100} />
        <Text style={styles.title}>Dinner Bell!</Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Time to eat</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      <Pressable
        style={[styles.dismissBtn, { backgroundColor: colors.primaryButton }]}
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss bell notification"
      >
        <Text style={[styles.dismissText, { color: colors.primaryButtonText }]}>Dismiss</Text>
      </Pressable>
      <CelebrationOverlay visible={played} headline="Dinner is served!" displayDuration={3000} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  bellBox: {
    alignItems: 'center',
    marginBottom: spacing.xxl + spacing.lg,
  },
  title: {
    fontSize: typography.title - 2,
    fontWeight: 'bold',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.h3 - 2,
  },
  message: {
    fontSize: typography.body,
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },
  dismissBtn: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.input,
  },
  dismissText: {
    fontSize: typography.h3,
    fontWeight: '600',
  },
  guestActions: { marginTop: spacing.xl, gap: spacing.md },
  guestBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  guestBtnText: { fontSize: typography.meta + 1, fontWeight: '500' },
});

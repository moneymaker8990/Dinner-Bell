import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { BrandLogo } from '@/components/BrandLogo';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, spacing, typography } from '@/constants/Theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { trackScreenViewed } from '@/lib/analytics';
import { playBellSound } from '@/lib/bellSound';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

export default function BellExperienceScreen() {
  const params = useLocalSearchParams<{ id: string; message?: string }>();
  const id = params.id;
  const messageFromParams = params.message;
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion();
  const [message, setMessage] = useState<string | null>(messageFromParams ?? null);
  const [played, setPlayed] = useState(false);
  const bellScale = useSharedValue(1);
  const bellTilt = useSharedValue(0);

  useEffect(() => {
    trackScreenViewed('RingBell');
  }, []);

  useEffect(() => {
    if (messageFromParams) setMessage(messageFromParams);
  }, [messageFromParams]);

  useEffect(() => {
    if (played) return;
    setPlayed(true);
    void playBellSound();
    if (!reduceMotion) {
      bellScale.value = withSequence(
        withTiming(1.08, { duration: 180, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 240, easing: Easing.inOut(Easing.ease) })
      );
      bellTilt.value = withSequence(
        withTiming(-6, { duration: 80, easing: Easing.out(Easing.ease) }),
        withTiming(6, { duration: 120, easing: Easing.inOut(Easing.ease) }),
        withTiming(-4, { duration: 120, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 160, easing: Easing.inOut(Easing.ease) })
      );
    }
  }, [bellScale, bellTilt, played, reduceMotion]);

  const bellAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bellScale.value }, { rotate: `${bellTilt.value}deg` }],
  }));

  const handleRingAgain = async () => {
    await playBellSound();
    if (reduceMotion) return;
    bellScale.value = withSequence(
      withTiming(1.06, { duration: 150, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.ease) })
    );
    bellTilt.value = withSequence(
      withTiming(-5, { duration: 70, easing: Easing.out(Easing.ease) }),
      withTiming(5, { duration: 110, easing: Easing.inOut(Easing.ease) }),
      withTiming(0, { duration: 140, easing: Easing.inOut(Easing.ease) })
    );
  };

  const handleDismiss = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.bellBox}>
        <Animated.View style={bellAnimStyle}>
          <BrandLogo size={100} variant="primary" />
        </Animated.View>
        <Text style={styles.title}>Dinner Bell!</Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Time to eat</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      <Pressable
        style={styles.ringAgainBtn}
        onPress={handleRingAgain}
        accessibilityRole="button"
        accessibilityLabel="Ring bell again"
      >
        <Text style={[styles.ringAgainText, { color: colors.tint }]}>Ring again</Text>
      </Pressable>
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
  ringAgainBtn: {
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  ringAgainText: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  dismissText: {
    fontSize: typography.h3,
    fontWeight: '600',
  },
  guestActions: { marginTop: spacing.xl, gap: spacing.md },
  guestBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  guestBtnText: { fontSize: typography.meta + 1, fontWeight: '500' },
});

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { hapticBell } from '@/lib/haptics';
import { triggerBellPush } from '@/lib/triggerBell';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

const COOLDOWN_MS = 30000;
const STORAGE_KEY = (eid: string) => `last_bell_ring_${eid}`;

interface RingBellButtonProps {
  eventId: string;
  bellSound?: string | null;
}

export function RingBellButton({ eventId, bellSound }: RingBellButtonProps) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [lastRingAt, setLastRingAt] = useState<number>(0);
  const [tick, setTick] = useState(0);
  const defaultMessage = 'Food is on the table!';

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY(eventId)).then((v) => {
      if (v) setLastRingAt(parseInt(v, 10) || 0);
    });
  }, [eventId]);

  useEffect(() => {
    const remaining = COOLDOWN_MS - (Date.now() - lastRingAt);
    if (remaining <= 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [lastRingAt]);

  const handleRing = useCallback(async () => {
    const now = Date.now();
    const remaining = COOLDOWN_MS - (now - lastRingAt);
    if (remaining > 0) {
      const sec = Math.ceil(remaining / 1000);
      return;
    }
    hapticBell();
    await triggerBellPush(eventId, defaultMessage);
    setLastRingAt(now);
    AsyncStorage.setItem(STORAGE_KEY(eventId), String(now));
    const q = new URLSearchParams({ message: defaultMessage });
    if (bellSound) q.set('sound', bellSound);
    router.push(`/event/${eventId}/bell?${q.toString()}`);
  }, [eventId, bellSound, lastRingAt, router]);

  const remaining = COOLDOWN_MS - (Date.now() - lastRingAt);
  const cooldownActive = remaining > 0;
  const cooldownSec = Math.ceil(remaining / 1000);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: cooldownActive ? colors.border : colors.primaryButton },
        pressed && !cooldownActive && styles.buttonPressed,
      ]}
      onPress={handleRing}
      disabled={cooldownActive}
    >
      <Text style={[styles.buttonText, { color: cooldownActive ? colors.textSecondary : colors.primaryButtonText }]}>
        {cooldownActive ? `Ring again in ${cooldownSec}s` : 'Ring Dinner Bell'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonPressed: { opacity: 0.9 },
  buttonText: { fontSize: 18, fontWeight: '600' },
});

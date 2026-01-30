import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { triggerBellPush } from '@/lib/triggerBell';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

interface RingBellButtonProps {
  eventId: string;
}

export function RingBellButton({ eventId }: RingBellButtonProps) {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const defaultMessage = 'Food is on the table!';
  const handleRing = async () => {
    await triggerBellPush(eventId, defaultMessage);
    router.push(`/event/${eventId}/bell?message=${encodeURIComponent(defaultMessage)}`);
  };
  return (
    <Pressable
      style={({ pressed }) => [styles.button, { backgroundColor: colors.primaryButton }, pressed && styles.buttonPressed]}
      onPress={handleRing}
    >
      <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>Ring Dinner Bell</Text>
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

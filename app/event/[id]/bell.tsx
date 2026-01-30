import { DinnerTriangleIcon } from '@/components/DinnerTriangleIcon';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
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
      >
        <Text style={[styles.dismissText, { color: colors.primaryButtonText }]}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bellBox: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
  },
  message: {
    fontSize: 16,
    marginTop: 16,
    fontStyle: 'italic',
  },
  dismissBtn: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  dismissText: {
    fontSize: 18,
    fontWeight: '600',
  },
});

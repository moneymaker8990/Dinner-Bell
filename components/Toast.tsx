import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { cardShadow, radius, spacing, typography } from '@/constants/Theme';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, ViewStyle } from 'react-native';

export interface ToastMessage {
  id: string;
  text: string;
}

interface ToastProps {
  message: ToastMessage | null;
  onDismiss: (id: string) => void;
  duration?: number;
  style?: ViewStyle;
}

export function Toast({ message, onDismiss, duration = 3000, style }: ToastProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const opacity = useRef(new Animated.Value(0)).current;

  const useNativeDriver = Platform.OS !== 'web';
  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, useNativeDriver, duration: 200 }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, useNativeDriver, duration: 200 }).start(() => {
        onDismiss(message.id);
      });
    }, duration);
    return () => clearTimeout(t);
  }, [message?.id, duration, onDismiss, opacity, useNativeDriver]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        cardShadow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity,
        },
        style,
      ]}>
      <Text style={[styles.text, { color: colors.textPrimary }]}>{message.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.button,
    borderWidth: 1,
    alignSelf: 'center',
    maxWidth: 400,
  },
  text: {
    fontSize: typography.body,
    textAlign: 'center',
  },
});
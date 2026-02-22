import React from 'react';
import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, spacing, typography } from '@/constants/Theme';
import { StyleSheet, View, ViewStyle } from 'react-native';

type Variant = 'default' | 'sage' | 'tomato';

interface StatPillProps {
  label: string;
  variant?: Variant;
  style?: ViewStyle;
}

export const StatPill = React.memo(function StatPill({ label, variant = 'default', style }: StatPillProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const bg =
    variant === 'sage'
      ? colors.accentSageFaint
      : variant === 'tomato'
        ? colors.accentTomatoFaint
        : colors.borderStrong;
  const textColor =
    variant === 'sage'
      ? colors.accentSage
      : variant === 'tomato'
        ? colors.accentTomato
        : colors.textSecondary;

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '500',
  },
});

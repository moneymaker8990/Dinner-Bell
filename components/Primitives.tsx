import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import React from 'react';
import { StyleSheet, TextProps, ViewProps } from 'react-native';

export function Screen({ style, ...rest }: ViewProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return <View {...rest} style={[styles.screen, { backgroundColor: colors.background }, style]} />;
}

export function SectionTitle({ style, ...rest }: TextProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return <Text {...rest} style={[styles.sectionTitle, { color: colors.textPrimary }, style]} />;
}

export function MutedText({ style, ...rest }: TextProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  return <Text {...rest} style={[styles.mutedText, { color: colors.textSecondary }, style]} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  mutedText: {
    fontSize: typography.body,
    fontWeight: '500',
  },
});

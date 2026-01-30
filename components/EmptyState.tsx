import { DinnerTriangleIcon } from '@/components/DinnerTriangleIcon';
import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { StyleSheet, View, ViewStyle } from 'react-native';

type EmptyStateVariant = 'default' | 'events';

interface EmptyStateProps {
  headline: string;
  body: string;
  primaryCta: React.ReactNode;
  secondaryCta?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: EmptyStateVariant;
  style?: ViewStyle;
}

export function EmptyState({
  headline,
  body,
  primaryCta,
  secondaryCta,
  icon,
  variant = 'default',
  style,
}: EmptyStateProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const defaultIcon =
    icon ??
    (variant === 'events' ? (
      <FontAwesome name="calendar-o" size={64} color={colors.tint} />
    ) : (
      <DinnerTriangleIcon size={72} color={colors.tint} />
    ));

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.tint + '18' }]}>
        {defaultIcon}
      </View>
      <Text style={[styles.headline, { color: colors.textPrimary }]}>{headline}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
      <View style={styles.ctas}>
        {primaryCta}
        {secondaryCta ? <View style={styles.secondaryCta}>{secondaryCta}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconWrap: {
    marginBottom: spacing.lg,
    padding: spacing.xl,
    borderRadius: 999,
  },
  headline: {
    fontSize: typography.h2,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 28,
  },
  body: {
    fontSize: typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
    maxWidth: 320,
  },
  ctas: {
    alignItems: 'center',
    gap: spacing.md,
  },
  secondaryCta: {
    marginTop: spacing.sm,
  },
});

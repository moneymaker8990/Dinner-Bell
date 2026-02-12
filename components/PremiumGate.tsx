import { PrimaryButton } from '@/components/Buttons';
import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { lineHeight, radius, spacing, typography } from '@/constants/Theme';
import { isFeatureAvailable, PREMIUM_FEATURE_LABELS, type PremiumFeature } from '@/lib/premium';
import { StyleSheet, ViewStyle } from 'react-native';

interface PremiumGateProps {
  /** Feature to check */
  feature: PremiumFeature;
  /** Content to render when feature is available */
  children: React.ReactNode;
  /** Optional style for the gate wrapper */
  style?: ViewStyle;
}

/**
 * Wraps premium content. Shows children if unlocked; shows tasteful paywall nudge if not.
 * No hard dead-ends — always explains the value and offers upgrade.
 */
export function PremiumGate({ feature, children, style }: PremiumGateProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (isFeatureAvailable(feature)) {
    return <>{children}</>;
  }

  const label = PREMIUM_FEATURE_LABELS[feature];

  return (
    <View style={[styles.gate, { backgroundColor: colors.surface2, borderColor: colors.border }, style]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{label.title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{label.description}</Text>
      <PrimaryButton style={styles.cta} onPress={() => {/* navigate to paywall */}}>
        Unlock with Premium
      </PrimaryButton>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    padding: spacing.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.headline,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: lineHeight.meta,
  },
  cta: {
    width: '100%',
  },
});

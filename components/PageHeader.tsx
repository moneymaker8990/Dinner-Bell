import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import { StyleSheet, ViewStyle } from 'react-native';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  style?: ViewStyle;
}

export function PageHeader({ title, subtitle, actions, style }: PageHeaderProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View
      style={[styles.wrapper, { borderBottomColor: colors.border }, style]}
      lightColor={colors.background}
      darkColor={colors.background}
    >
      <View style={styles.textBlock}>
        <Text
          style={[styles.title, { color: colors.textPrimary }]}
          accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    borderBottomWidth: 1,
    paddingBottom: spacing.md,
    marginBottom: spacing.xl,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.body,
    marginTop: spacing.sm,
    opacity: 0.9,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
});

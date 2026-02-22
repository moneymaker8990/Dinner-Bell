import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { letterSpacing, radius, spacing, typography } from '@/constants/Theme';
import { StyleSheet, ViewStyle } from 'react-native';

interface SectionProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Section({ title, action, children, style, collapsible, collapsed, onToggle }: SectionProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: colors.textSecondary }]}
          onPress={collapsible ? onToggle : undefined}
        >
          {title}
          {collapsible ? (collapsed ? '  +' : '  -') : ''}
        </Text>
        {action ?? null}
      </View>
      {!collapsed && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.cta,
  },
  content: {},
});

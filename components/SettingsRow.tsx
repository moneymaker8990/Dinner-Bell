import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

interface SettingsRowProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function SettingsRow({ title, subtitle, icon, right, style, onPress }: SettingsRowProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const content = (
    <>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable style={[styles.row, style]} onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.row, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    minHeight: 44,
  },
  icon: {},
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.body,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: typography.caption,
    marginTop: 2,
  },
  right: {
    flexShrink: 0,
  },
});

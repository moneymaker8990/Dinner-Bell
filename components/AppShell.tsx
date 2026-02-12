import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { contentMaxWidth, spacing, typography } from '@/constants/Theme';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HORIZONTAL_PADDING = spacing.xl;

interface AppShellProps {
  children: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  noPadding?: boolean;
  /** Optional contextual title (premium app shell) */
  title?: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Optional right-side utility actions (e.g. icon buttons) */
  utilityActions?: React.ReactNode;
}

export function AppShell({
  children,
  style,
  contentContainerStyle,
  noPadding,
  title,
  subtitle,
  utilityActions,
}: AppShellProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.outer,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
        style,
      ]}>
      {(title != null || subtitle != null || utilityActions != null) && (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerText}>
            {title != null && (
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {title}
              </Text>
            )}
            {subtitle != null && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
          {utilityActions != null ? <View style={styles.actions}>{utilityActions}</View> : null}
        </View>
      )}
      <View
        style={[
          styles.container,
          !noPadding && {
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingVertical: spacing.lg,
          },
          contentContainerStyle,
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: typography.meta,
    marginTop: spacing.xs / 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  container: {
    flex: 1,
    maxWidth: contentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
});

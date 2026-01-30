import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { spacing } from '@/constants/Theme';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_WIDTH = 1100;
const HORIZONTAL_PADDING = spacing.xl;

interface AppShellProps {
  children: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  noPadding?: boolean;
}

export function AppShell({ children, style, contentContainerStyle, noPadding }: AppShellProps) {
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
  container: {
    flex: 1,
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
});

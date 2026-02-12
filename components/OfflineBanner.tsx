import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { spacing, typography } from '@/constants/Theme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Shows a banner when the device is offline.
 * Place at top of screens or in AppShell.
 */
export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (isConnected) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.warn }]}>
      <Text style={[styles.text, { color: colors.primaryButtonText }]}>
        {Copy.offline.banner}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  text: {
    fontSize: typography.microLabel,
    fontWeight: '600',
  },
});

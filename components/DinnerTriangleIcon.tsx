import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { StyleSheet, View } from 'react-native';

interface DinnerTriangleIconProps {
  size?: number;
  color?: string;
}

/**
 * Dinner-bell triangle icon: upward-pointing triangle (wide at bottom, point at top)
 * with optional small "striker" circle. Uses theme tint (amber/brass) by default.
 */
export function DinnerTriangleIcon({ size = 64, color }: DinnerTriangleIconProps) {
  const scheme = useColorScheme() ?? 'light';
  const fill = color ?? Colors[scheme].tint;

  // Triangle via border trick: point at top, wide at bottom
  const half = size / 2;
  const triHeight = size * 0.85;

  return (
    <View style={[styles.wrapper, { width: size, height: triHeight }]}>
      <View
        style={[
          styles.triangle,
          {
            borderLeftWidth: half,
            borderRightWidth: half,
            borderBottomWidth: triHeight,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: fill,
          },
        ]}
      />
      {/* Small striker circle (dinner-bell beater) */}
      <View
        style={[
          styles.striker,
          {
            width: Math.max(6, size * 0.16),
            height: Math.max(6, size * 0.16),
            borderRadius: Math.max(3, size * 0.08),
            backgroundColor: fill,
            opacity: 0.85,
            top: triHeight * 0.15,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  triangle: {
    width: 0,
    height: 0,
    alignSelf: 'center',
  },
  striker: {
    position: 'absolute',
    alignSelf: 'center',
  },
});

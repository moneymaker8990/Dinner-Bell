import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { duration } from '@/constants/Motion';
import { spacing, typography } from '@/constants/Theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

interface ProgressBarProps {
  /** Progress value from 0 to 1 */
  progress: number;
  /** Bar color. Defaults to primaryBrand. */
  color?: string;
  /** Track (background) color. Defaults to border. */
  trackColor?: string;
  /** Height of the bar. Defaults to 6. */
  height?: number;
  /** Optional label displayed above the bar (e.g. "Step 3 of 7") */
  label?: string;
  /** Show percentage text to the right */
  showPercent?: boolean;
}

/**
 * Animated horizontal progress bar with Reanimated interpolation.
 * Color-customizable with optional label slot.
 */
export function ProgressBar({
  progress,
  color,
  trackColor,
  height = 6,
  label,
  showPercent = false,
}: ProgressBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const reduceMotion = useReducedMotion();

  const barColor = color ?? c.primaryBrand;
  const bgColor = trackColor ?? c.border;

  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, progress));
    animatedProgress.value = withTiming(clamped, {
      duration: reduceMotion ? 0 : duration.regular,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reduceMotion, animatedProgress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%` as any,
  }));

  return (
    <View style={styles.wrapper}>
      {(label || showPercent) && (
        <View style={styles.labelRow}>
          {label && (
            <Text style={[styles.label, { color: c.textSecondary }]}>
              {label}
            </Text>
          )}
          {showPercent && (
            <Text style={[styles.percent, { color: c.textSecondary }]}>
              {Math.round(progress * 100)}%
            </Text>
          )}
        </View>
      )}
      <View
        style={[
          styles.track,
          { height, borderRadius: height / 2, backgroundColor: bgColor },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            fillStyle,
            { height, borderRadius: height / 2, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.microLabel,
    fontWeight: '500',
  },
  percent: {
    fontSize: typography.microLabel,
    fontWeight: '600',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { cardShadow, radius, spacing } from '@/constants/Theme';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View, ViewStyle } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = '100%',
  height = 24,
  borderRadius = radius.card,
  style,
}: SkeletonLoaderProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const opacity = useRef(new Animated.Value(0.3)).current;

  const useNativeDriver = Platform.OS !== 'web';
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, useNativeDriver, duration: 700 }),
        Animated.timing(opacity, { toValue: 0.3, useNativeDriver, duration: 700 }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, useNativeDriver]);

  const bgColor = colorScheme === 'dark' ? colors.border : colors.border + '99';

  const widthStyle: ViewStyle = width !== undefined ? { width } : {};

  return (
    <Animated.View
      style={[
        {
          height,
          borderRadius,
          backgroundColor: bgColor,
          opacity,
        },
        widthStyle,
        style,
      ]}
    />
  );
}

/** Placeholder for a list of card-shaped skeletons (e.g. events list). */
export function SkeletonCardList({ count = 3 }: { count?: number }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.cardList}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.cardSkeleton,
            cardShadow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: radius.card,
            },
          ]}
        >
          {/* Title line */}
          <SkeletonLoader height={20} width="65%" borderRadius={6} />
          {/* Date line */}
          <View style={styles.metaRow}>
            <SkeletonLoader height={12} width={12} borderRadius={6} style={styles.metaDot} />
            <SkeletonLoader height={14} width="45%" borderRadius={4} />
          </View>
          {/* Location line */}
          <View style={styles.metaRow}>
            <SkeletonLoader height={12} width={12} borderRadius={6} style={styles.metaDot} />
            <SkeletonLoader height={14} width="35%" borderRadius={4} />
          </View>
          {/* Pills */}
          <View style={styles.cardPills}>
            <SkeletonLoader height={28} width={100} borderRadius={radius.chip} />
            <SkeletonLoader height={28} width={80} borderRadius={radius.chip} />
          </View>
          {/* Footer */}
          <View style={[styles.footerSkeleton, { borderTopColor: colors.border }]}>
            <SkeletonLoader height={16} width={50} borderRadius={4} />
            <SkeletonLoader height={16} width={70} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cardList: {
    gap: spacing.md,
  },
  cardSkeleton: {
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  metaDot: {
    flexShrink: 0,
  },
  cardPills: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  footerSkeleton: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
});

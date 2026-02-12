import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { duration } from '@/constants/Motion';
import { fontWeight, spacing, typography, zIndex } from '@/constants/Theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ConfettiParticle {
  id: number;
  x: number;
  delay: number;
  color: string;
  size: number;
  rotation: number;
}

interface CelebrationOverlayProps {
  /** Whether the celebration is currently visible */
  visible: boolean;
  /** Called when the celebration finishes */
  onFinish?: () => void;
  /** Duration in ms before auto-dismissing. Defaults to 2500. */
  displayDuration?: number;
  /** Optional headline, e.g. "You're all set!" */
  headline?: string;
  /** Optional subtitle */
  subtitle?: string;
}

/**
 * Full-screen confetti/particle celebration overlay for success moments.
 * Uses Reanimated for silky smooth particles. Falls back gracefully when
 * reduced motion is enabled (simple fade instead of particles).
 */
export function CelebrationOverlay({
  visible,
  onFinish,
  displayDuration = 2500,
  headline,
  subtitle,
}: CelebrationOverlayProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const reduceMotion = useReducedMotion();
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);

  const opacity = useSharedValue(0);
  const textScale = useSharedValue(0.5);

  useEffect(() => {
    if (visible) {
      // Generate confetti particles
      const newParticles: ConfettiParticle[] = Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        delay: Math.random() * 600,
        color: c.confetti[Math.floor(Math.random() * c.confetti.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
      }));
      setParticles(newParticles);

      // Fade in
      opacity.value = withTiming(1, { duration: duration.fast });

      // Text entrance
      if (!reduceMotion) {
        textScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      } else {
        textScale.value = 1;
      }

      // Auto-dismiss
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: duration.regular }, () => {
          if (onFinish) runOnJS(onFinish)();
        });
      }, displayDuration);

      return () => clearTimeout(timer);
    } else {
      opacity.value = 0;
      textScale.value = 0.5;
      setParticles([]);
    }
  }, [visible, displayDuration, reduceMotion, opacity, textScale, onFinish]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    pointerEvents: opacity.value > 0 ? 'auto' as const : 'none' as const,
  }));

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ scale: textScale.value }],
  }));

  if (!visible && particles.length === 0) return null;

  return (
    <Animated.View style={[styles.container, { backgroundColor: c.overlay }, containerStyle]}>
      {/* Confetti particles */}
      {!reduceMotion &&
        particles.map((p) => (
          <ConfettiPiece key={p.id} particle={p} />
        ))}

      {/* Center text */}
      {(headline || subtitle) && (
        <Animated.View style={[styles.textContainer, textStyle]}>
          {headline && (
            <Text style={[styles.headline, { color: c.onOverlay }]}>{headline}</Text>
          )}
          {subtitle && (
            <Text style={[styles.subtitle, { color: c.onOverlayMuted }]}>{subtitle}</Text>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function ConfettiPiece({ particle }: { particle: ConfettiParticle }) {
  const translateY = useSharedValue(-20);
  const rotate = useSharedValue(0);
  const pieceOpacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      particle.delay,
      withTiming(SCREEN_HEIGHT + 50, {
        duration: 2000 + Math.random() * 1000,
        easing: Easing.in(Easing.quad),
      })
    );
    rotate.value = withDelay(
      particle.delay,
      withTiming(particle.rotation + 720, {
        duration: 2500,
        easing: Easing.linear,
      })
    );
    pieceOpacity.value = withDelay(
      particle.delay + 1500,
      withTiming(0, { duration: 500 })
    );
  }, [translateY, rotate, pieceOpacity, particle]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: pieceOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        style,
        {
          left: particle.x,
          width: particle.size,
          height: particle.size * 1.5,
          backgroundColor: particle.color,
          borderRadius: particle.size / 4,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: zIndex.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confettiPiece: {
    position: 'absolute',
    top: -20,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  headline: {
    fontSize: typography.title,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: typography.body,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

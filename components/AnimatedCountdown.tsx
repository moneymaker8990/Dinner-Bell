import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fontWeight, radius, spacing, typography } from '@/constants/Theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

interface AnimatedCountdownProps {
  /** ISO string of the bell/target time */
  bellTime: string;
  /** Compact mode for cards (smaller text) */
  compact?: boolean;
}

type Phase = 'far' | 'day' | 'hour' | 'passed';

function getPhase(bellTimeMs: number): Phase {
  const diff = bellTimeMs - Date.now();
  if (diff <= 0) return 'passed';
  if (diff < 60 * 60 * 1000) return 'hour';
  if (diff < 24 * 60 * 60 * 1000) return 'day';
  return 'far';
}

function formatTimeUnit(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Animated countdown component with phase transitions:
 * - >24h: static "Xd Xh" text
 * - <24h: flip-clock style HH:MM:SS
 * - <1h: pulsing glow + urgency color
 * - Bell passed: "Dinner is on!" animated state
 */
export function AnimatedCountdown({ bellTime, compact = false }: AnimatedCountdownProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const reduceMotion = useReducedMotion();
  const bellTimeMs = new Date(bellTime).getTime();

  const [phase, setPhase] = useState<Phase>(getPhase(bellTimeMs));
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [days, setDays] = useState(0);

  // Pulse animation for < 1h urgency
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  // Update timer every second
  useEffect(() => {
    const update = () => {
      const diff = bellTimeMs - Date.now();
      const newPhase = getPhase(bellTimeMs);
      setPhase(newPhase);

      if (diff <= 0) {
        setHours(0);
        setMinutes(0);
        setSeconds(0);
        return;
      }

      const totalSec = Math.floor(diff / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;

      setDays(d);
      setHours(h);
      setMinutes(m);
      setSeconds(s);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [bellTimeMs]);

  // Pulsing for < 1h
  useEffect(() => {
    if (phase === 'hour' && !reduceMotion) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 600 }),
          withTiming(0.2, { duration: 600 })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = 1;
      glowOpacity.value = 0;
    }
  }, [phase, reduceMotion, pulseScale, glowOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const isUrgent = phase === 'hour';
  const accentColor = isUrgent ? c.error : c.primaryBrand;
  const textSize = compact ? typography.body : typography.headline;
  const unitSize = compact ? typography.microLabel : typography.meta;

  if (phase === 'passed') {
    return (
      <View style={styles.container}>
        <Text style={[
          styles.passedText,
          { color: c.success, fontSize: compact ? typography.body : typography.headline },
        ]}>
          Dinner is on!
        </Text>
      </View>
    );
  }

  if (phase === 'far') {
    return (
      <View style={styles.container}>
        <Text style={[styles.farText, { color: c.textSecondary, fontSize: textSize }]}>
          {days}d {hours}h until bell
        </Text>
      </View>
    );
  }

  // day or hour phase — flip-clock style
  return (
    <Animated.View style={[styles.container, pulseStyle]}>
      {/* Glow ring for urgency */}
      {isUrgent && (
        <Animated.View style={[styles.glowRing, glowStyle, { borderColor: accentColor }]} />
      )}

      <View style={styles.clockRow}>
        {/* Hours */}
        <View style={styles.clockUnit}>
          <View style={[styles.digitBox, { backgroundColor: c.elevatedSurface, borderColor: c.border }]}>
            <Text style={[styles.digitText, { color: accentColor, fontSize: textSize }]}>
              {formatTimeUnit(hours)}
            </Text>
          </View>
          <Text style={[styles.unitLabel, { color: c.textSecondary, fontSize: unitSize }]}>hr</Text>
        </View>

        <Text style={[styles.separator, { color: accentColor, fontSize: textSize }]}>:</Text>

        {/* Minutes */}
        <View style={styles.clockUnit}>
          <View style={[styles.digitBox, { backgroundColor: c.elevatedSurface, borderColor: c.border }]}>
            <Text style={[styles.digitText, { color: accentColor, fontSize: textSize }]}>
              {formatTimeUnit(minutes)}
            </Text>
          </View>
          <Text style={[styles.unitLabel, { color: c.textSecondary, fontSize: unitSize }]}>min</Text>
        </View>

        <Text style={[styles.separator, { color: accentColor, fontSize: textSize }]}>:</Text>

        {/* Seconds */}
        <View style={styles.clockUnit}>
          <View style={[styles.digitBox, { backgroundColor: c.elevatedSurface, borderColor: c.border }]}>
            <Text style={[styles.digitText, { color: accentColor, fontSize: textSize }]}>
              {formatTimeUnit(seconds)}
            </Text>
          </View>
          <Text style={[styles.unitLabel, { color: c.textSecondary, fontSize: unitSize }]}>sec</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  clockUnit: {
    alignItems: 'center',
  },
  digitBox: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 48,
    alignItems: 'center',
  },
  digitText: {
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  separator: {
    fontWeight: fontWeight.bold,
    marginBottom: spacing.lg,
  },
  farText: {
    fontWeight: fontWeight.semibold,
  },
  passedText: {
    fontWeight: fontWeight.bold,
  },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: radius.card,
    margin: -spacing.sm,
  },
});

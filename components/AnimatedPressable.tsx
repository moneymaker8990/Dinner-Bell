import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hapticTap } from '@/lib/haptics';
import Colors from '@/constants/Colors';
import { border, getElevation, radius, spacing } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import React, { useCallback } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

interface AnimatedPressableProps extends PressableProps {
  /** Scale when pressed. Defaults to 0.97. */
  pressScale?: number;
  /** Optional premium variants for CTA styling. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Enable light haptic feedback on press. */
  enableHaptics?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Premium pressable with Reanimated spring scale-down on press.
 * Replaces plain Pressable for all interactive card/button elements.
 * Respects reduced-motion preference.
 */
export function AnimatedPressable({
  pressScale = 0.97,
  variant,
  enableHaptics = false,
  style,
  children,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  const reduceMotion = useReducedMotion();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const scale = useSharedValue(1);
  const y = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: y.value }],
  }));

  const handlePressIn = useCallback(
    (e: any) => {
      if (enableHaptics && !disabled) hapticTap();
      if (!reduceMotion) {
        scale.value = withSpring(pressScale, {
          damping: 15,
          stiffness: 300,
          mass: 0.8,
        });
        y.value = withSpring(1, {
          damping: 16,
          stiffness: 320,
          mass: 0.8,
        });
      }
      onPressIn?.(e);
    },
    [disabled, enableHaptics, onPressIn, pressScale, reduceMotion, scale, y]
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 300,
        mass: 0.8,
      });
      y.value = withSpring(0, {
        damping: 16,
        stiffness: 320,
        mass: 0.8,
      });
      onPressOut?.(e);
    },
    [onPressOut, scale, y]
  );

  const variantStyle: ViewStyle | undefined =
    variant === 'primary'
      ? {
          backgroundColor: colors.primaryButton,
          borderRadius: radius.input,
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing.lg,
          borderWidth: border.subtle,
          borderColor: colors.primaryButton,
          ...getElevation('raised', colors.shadow),
        }
      : variant === 'secondary'
        ? {
            backgroundColor: colors.card,
            borderRadius: radius.input,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.lg,
            borderWidth: border.subtle,
            borderColor: colors.border,
            ...getElevation('flat', colors.shadow),
          }
        : variant === 'ghost'
          ? {
              borderRadius: radius.input,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
              borderWidth: 0,
            }
          : undefined;

  return (
    <Animated.View style={[variantStyle, animatedStyle, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={{ borderRadius: radius.input }}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

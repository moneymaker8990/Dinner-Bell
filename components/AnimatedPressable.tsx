import { useReducedMotion } from '@/hooks/useReducedMotion';
import React, { useCallback } from 'react';
import { PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(
  require('react-native').Pressable
);

interface AnimatedPressableProps extends PressableProps {
  /** Scale when pressed. Defaults to 0.97. */
  pressScale?: number;
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
  style,
  children,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (e: any) => {
      if (!reduceMotion) {
        scale.value = withSpring(pressScale, {
          damping: 15,
          stiffness: 300,
          mass: 0.8,
        });
      }
      onPressIn?.(e);
    },
    [reduceMotion, pressScale, onPressIn, scale]
  );

  const handlePressOut = useCallback(
    (e: any) => {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 300,
        mass: 0.8,
      });
      onPressOut?.(e);
    },
    [onPressOut, scale]
  );

  return (
    <AnimatedPressableBase
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}

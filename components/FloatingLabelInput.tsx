import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { duration } from '@/constants/Motion';
import { border, radius, spacing, typography } from '@/constants/Theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Platform,
    Pressable,
    StyleProp,
    StyleSheet,
    TextInput,
    TextInputProps,
    ViewStyle,
} from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';

interface FloatingLabelInputProps extends Omit<TextInputProps, 'placeholder' | 'style'> {
  /** Label that floats above the input when focused/filled */
  label: string;
  /** Error message — shows red border and error text */
  error?: string;
  /** Show clear button when input has value */
  clearable?: boolean;
  /** Called when clear button pressed */
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Premium TextInput with animated floating label (Reanimated),
 * focus ring with accent color, error state with shake animation,
 * and clear button. Replaces all raw TextInput across the app.
 */
export function FloatingLabelInput({
  label,
  error,
  clearable = true,
  onClear,
  value,
  onFocus,
  onBlur,
  style,
  ...rest
}: FloatingLabelInputProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  // 0 = resting (label as placeholder), 1 = active (label floated up)
  const active = useSharedValue(value ? 1 : 0);
  const shake = useSharedValue(0);

  const isActive = isFocused || !!value;

  useEffect(() => {
    active.value = withTiming(isActive ? 1 : 0, {
      duration: reduceMotion ? 0 : duration.fast,
    });
  }, [isActive, reduceMotion, active]);

  // Shake on error change
  useEffect(() => {
    if (error && !reduceMotion) {
      shake.value = withTiming(1, { duration: 50 }, () => {
        shake.value = withTiming(-1, { duration: 50 }, () => {
          shake.value = withTiming(0.5, { duration: 50 }, () => {
            shake.value = withTiming(0, { duration: 50 });
          });
        });
      });
    }
  }, [error, reduceMotion, shake]);

  const labelStyle = useAnimatedStyle(() => {
    const translateY = interpolate(active.value, [0, 1], [0, -24]);
    const fontSize = interpolate(active.value, [0, 1], [typography.body, typography.microLabel]);

    return {
      transform: [{ translateY }],
      fontSize,
    };
  });

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 6 }],
  }));

  const borderColor = error
    ? c.error
    : isFocused
    ? c.primaryBrand
    : c.inputBorder;

  const showClear = clearable && !!value && isFocused;

  return (
    <Animated.View style={[containerAnimStyle, style]}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={[
          styles.container,
          {
            borderColor,
            backgroundColor: c.elevatedSurface,
            borderWidth: isFocused ? border.focusRing : border.hairline,
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.label,
            labelStyle,
            {
              color: error
                ? c.error
                : isFocused
                ? c.primaryBrand
                : c.placeholder,
            },
          ]}
          pointerEvents="none"
        >
          {label}
        </Animated.Text>
        <TextInput
          ref={inputRef}
          value={value}
          style={[
            styles.input,
            {
              color: c.textPrimary,
            },
          ]}
          placeholderTextColor={c.placeholder}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          selectionColor={c.primaryBrand}
          {...rest}
        />
        {showClear && (
          <Pressable
            onPress={() => {
              onClear?.();
            }}
            style={styles.clearButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear input"
          >
            <Ionicons name="close-circle" size={18} color={c.placeholder} />
          </Pressable>
        )}
      </Pressable>
      {error && (
        <Animated.Text style={[styles.errorText, { color: c.error }]}>
          {error}
        </Animated.Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.input,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  label: {
    position: 'absolute',
    left: spacing.lg,
    top: 18,
    fontWeight: '400',
  },
  input: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '400',
    paddingVertical: 0,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {},
    }),
  },
  clearButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  errorText: {
    fontSize: typography.microLabel,
    fontWeight: '500',
    marginTop: spacing.xs,
    marginLeft: spacing.lg,
  },
});

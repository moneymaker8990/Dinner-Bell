import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius, spacing, typography } from '@/constants/Theme';
import React from 'react';
import { Pressable, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';

const BUTTON_HEIGHT = 54;

interface BaseButtonProps {
  onPress?: () => void;
  children: string;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  // Allow passthrough props from Link asChild
  href?: string;
  [key: string]: any;
}

export const ButtonPrimary = React.forwardRef<View, BaseButtonProps>(
  function ButtonPrimary({ onPress, children, disabled, style, textStyle, ...rest }, ref) {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: colors.primaryButton,
            borderRadius: radius.button,
            opacity: disabled ? 0.5 : 1,
          },
          pressed && !disabled ? { backgroundColor: colors.pressed } : null,
          style,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        {...rest}>
        <Text style={[styles.text, { color: colors.primaryButtonText }, textStyle]}>{children}</Text>
      </Pressable>
    );
  }
);

export const SecondaryButton = React.forwardRef<View, BaseButtonProps>(
  function SecondaryButton({ onPress, children, disabled, style, textStyle, ...rest }, ref) {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.button,
            opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          },
          style,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        {...rest}>
        <Text style={[styles.text, { color: colors.textPrimary }, textStyle]}>{children}</Text>
      </Pressable>
    );
  }
);

export const ButtonSecondary = SecondaryButton;
export const PrimaryButton = ButtonPrimary;

export const ButtonDanger = React.forwardRef<View, BaseButtonProps>(
  function ButtonDanger({ onPress, children, disabled, style, textStyle, ...rest }, ref) {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.accentTomatoFaint,
            borderRadius: radius.button,
            opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          },
          style,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        {...rest}>
        <Text style={[styles.text, { color: colors.error }, textStyle]}>{children}</Text>
      </Pressable>
    );
  }
);

export function GhostButton({ onPress, children, disabled, style, textStyle }: BaseButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: 'transparent',
          borderRadius: radius.button,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}>
      <Text style={[styles.text, { color: colors.tint }, textStyle]}>{children}</Text>
    </Pressable>
  );
}

interface IconButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel: string;
}

export function IconButton({ onPress, icon, disabled, style, accessibilityLabel }: IconButtonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}>
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: BUTTON_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  iconBtn: {
    width: BUTTON_HEIGHT,
    height: BUTTON_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

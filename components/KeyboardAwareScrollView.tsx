import React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ScrollViewProps,
    StyleProp,
    StyleSheet,
    ViewStyle,
} from 'react-native';

interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  /** Extra padding at the bottom for keyboard avoidance. Defaults to 40. */
  extraBottomPadding?: number;
  /** Container style for the KeyboardAvoidingView wrapper */
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Platform-aware keyboard avoiding scroll view.
 * Uses `padding` behavior on iOS and `height` on Android for smooth offset.
 * Wrap all form screens with this component.
 */
export function KeyboardAwareScrollView({
  extraBottomPadding = 40,
  containerStyle,
  children,
  contentContainerStyle,
  ...scrollProps
}: KeyboardAwareScrollViewProps) {
  return (
    <KeyboardAvoidingView
      style={[styles.container, containerStyle]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: extraBottomPadding },
          contentContainerStyle,
        ]}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

import { DinnerTriangleIcon } from '@/components/DinnerTriangleIcon';
import Colors from '@/constants/Colors';
import { elevation, fontWeight, lineHeight, radius, spacing, typography } from '@/constants/Theme';
import { trackError } from '@/lib/analytics';
import React, { Component, type ErrorInfo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: React.ReactNode;
  /** Fallback component to render instead of default UI */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Custom error boundary with themed UI, DinnerTriangleIcon,
 * friendly message, and "Try again" button.
 * Logs errors to analytics via trackError.
 */
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to analytics
    trackError(error.message, errorInfo.componentStack ?? undefined);

    if (__DEV__) {
      console.error('AppErrorBoundary caught:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Using light theme colors as fallback since hooks can't be used in class components
      const colors = Colors.light;

      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <DinnerTriangleIcon size={80} color={colors.primaryBrand} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Something went wrong
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            We hit an unexpected bump. Don't worry — your data is safe.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={[styles.errorDetail, { color: colors.error }]} numberOfLines={5}>
              {this.state.error.message}
            </Text>
          )}
          <Pressable
            style={[styles.button, { backgroundColor: colors.primaryButton }]}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  title: {
    fontSize: typography.headline,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: typography.body,
    fontWeight: fontWeight.regular,
    textAlign: 'center',
    lineHeight: lineHeight.body,
    marginBottom: spacing.xl,
    maxWidth: 300,
  },
  errorDetail: {
    fontSize: typography.microLabel,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: spacing.xl,
    maxWidth: 300,
    textAlign: 'center',
  },
  button: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl + spacing.lg,
    borderRadius: radius.button,
    ...elevation.raised,
  },
  buttonText: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
});

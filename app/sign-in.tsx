import { AnimatedPressable } from '@/components/AnimatedPressable';
import { BrandLogo } from '@/components/BrandLogo';
import { FloatingLabelInput } from '@/components/FloatingLabelInput';
import { GradientHeader } from '@/components/GradientHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Copy } from '@/constants/Copy';
import { duration } from '@/constants/Motion';
import { elevation, fontFamily, fontWeight, letterSpacing, radius, spacing, typography } from '@/constants/Theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { trackSignIn, trackSignUp } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

const devEmail = process.env.EXPO_PUBLIC_DEV_EMAIL ?? '';
const devPassword = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? '';
const showDevSignIn = __DEV__ && !!devEmail && !!devPassword;

export default function SignInScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  // Entrance animation for form
  const formOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(30);

  useEffect(() => {
    const d = reduceMotion ? 0 : duration.emphasized;
    formOpacity.value = withDelay(200, withTiming(1, { duration: d }));
    formTranslateY.value = withDelay(200, withSpring(0, { damping: 18, stiffness: 120 }));
  }, [reduceMotion, formOpacity, formTranslateY]);

  const formStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTranslateY.value }],
  }));

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError(Copy.auth.emptyFields);
      return;
    }
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (e) {
      trackSignIn(false);
      const msg = e.message ?? '';
      if (msg.toLowerCase().includes('anonymous')) {
        setError(Copy.auth.emptyFields);
      } else if (msg.toLowerCase().includes('invalid') || e.status === 400) {
        setError(Copy.auth.invalidCredentials);
      } else {
        setError(msg);
      }
      return;
    }
    trackSignIn(true);
    router.back();
  };

  const handleDevSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email: devEmail, password: devPassword });
    setLoading(false);
    if (e) {
      trackSignIn(false);
      setError(e.message);
      return;
    }
    trackSignIn(true);
    router.back();
  };

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError(Copy.auth.signUpEmptyFields);
      return;
    }
    if (password.length < 6) {
      setError(Copy.auth.passwordTooShort);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(Copy.auth.invalidEmailFormat);
      return;
    }
    setLoading(true);
    setError(null);
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const { error: e } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: redirectUrl ? { emailRedirectTo: redirectUrl } : undefined,
    });
    setLoading(false);
    if (e) {
      trackSignUp(false);
      const msg = e.message ?? '';
      if (msg.toLowerCase().includes('anonymous')) {
        setError(Copy.auth.signUpPrompt);
      } else if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
        setError(Copy.auth.emailAlreadyRegistered);
      } else if (e.status === 422) {
        setError(msg || Copy.auth.signUpRejected);
      } else {
        setError(msg);
      }
      return;
    }
    trackSignUp(true);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero gradient header */}
      <GradientHeader height={260}>
        <View style={styles.heroContent}>
          <BrandLogo size={96} variant="default" />
          <Text style={[styles.heroTitle, { color: colors.onGradient }]}>Welcome to{'\n'}Dinner Bell</Text>
          <Text style={[styles.heroSubtitle, { color: colors.onGradientMuted }]}>
            Ring the bell and gather your people.
          </Text>
        </View>
      </GradientHeader>

      {/* Form area */}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        extraBottomPadding={60}
      >
        <Animated.View style={[styles.formContainer, formStyle]}>
          <FloatingLabelInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            onClear={() => setEmail('')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={error && error.toLowerCase().includes('email') ? error : undefined}
          />

          <View style={{ height: spacing.md }} />

          <FloatingLabelInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            onClear={() => setPassword('')}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
            error={error && error.toLowerCase().includes('password') ? error : undefined}
          />

          {error && !error.toLowerCase().includes('email') && !error.toLowerCase().includes('password') ? (
            <Animated.Text
              entering={reduceMotion ? undefined : FadeInDown.duration(200)}
              style={[styles.errorText, { color: colors.error }]}
            >
              {error}
            </Animated.Text>
          ) : null}

          {/* Primary sign-in button */}
          <AnimatedPressable
            variant="primary"
            enableHaptics
            style={[
              styles.primaryButton,
              {
                backgroundColor: loading ? colors.disabled : colors.primaryButton,
              },
              elevation.raised,
              { shadowColor: colors.shadow },
            ]}
            onPress={handleSignIn}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={Copy.common.signIn}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryButtonText} />
            ) : (
              <Text
                style={[styles.primaryButtonText, { color: colors.primaryButtonText }]}
              >
                {Copy.common.signIn}
              </Text>
            )}
          </AnimatedPressable>

          {/* Secondary create account button */}
          <AnimatedPressable
            variant="secondary"
            enableHaptics
            style={styles.secondaryButton}
            onPress={handleSignUp}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={Copy.auth.createAccount}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primaryBrand }]}>
              {Copy.auth.createAccount}
            </Text>
          </AnimatedPressable>

          {/* Dev sign-in (only in __DEV__) */}
          {showDevSignIn && (
            <AnimatedPressable
              style={[
                styles.devButton,
                { backgroundColor: colors.secondaryText },
              ]}
              onPress={handleDevSignIn}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={Copy.auth.devSignIn}
            >
              <Text style={[styles.devButtonText, { color: colors.primaryButtonText }]}>
                {Copy.auth.devSignIn}
              </Text>
            </AnimatedPressable>
          )}
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: typography.headline + 4,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    letterSpacing: letterSpacing.title,
    marginTop: spacing.md,
  },
  heroSubtitle: {
    fontSize: typography.body,
    fontWeight: fontWeight.regular,
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  formContainer: {
    gap: 0,
  },
  errorText: {
    fontSize: typography.meta,
    fontWeight: fontWeight.medium,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.subtitle,
  },
  secondaryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
  devButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.button,
    alignItems: 'center',
  },
  devButtonText: {
    fontSize: typography.meta,
    fontWeight: fontWeight.semibold,
  },
});

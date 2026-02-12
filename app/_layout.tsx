import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ONBOARDING_KEY } from '@/app/onboarding';
import { DeepLinkHandler } from '@/components/DeepLinkHandler';
import { AppErrorBoundary } from '@/components/ErrorBoundary';
import { NotificationHandler } from '@/components/NotificationHandler';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryClient } from '@/lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Custom warm themes from design tokens (no raw hex)
const lightColors = Colors.light;
const darkColors = Colors.dark;
const WarmLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: lightColors.primaryBrand,
    background: lightColors.background,
    card: lightColors.surface,
    text: lightColors.textPrimary,
    border: lightColors.border,
  },
};
const WarmDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.primaryBrand,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.textPrimary,
    border: darkColors.border,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e?.reason;
      if (reason?.name === 'AbortError' && typeof reason?.message === 'string' && reason.message.includes('aborted')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => setHasOnboarded(value === 'true'))
      .catch(() => setHasOnboarded(true));
  }, []);

  useEffect(() => {
    if (loaded && hasOnboarded !== null) {
      SplashScreen.hideAsync();
    }
  }, [loaded, hasOnboarded]);

  if (!loaded || hasOnboarded === null) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <RootLayoutNav hasOnboarded={hasOnboarded} />
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav({ hasOnboarded }: { hasOnboarded: boolean }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const screenOptions = {
    headerStyle: {
      backgroundColor: colors.background,
    },
    headerTintColor: colors.textPrimary,
    headerShadowVisible: false,
    contentStyle: {
      backgroundColor: colors.background,
    },
    animation: 'slide_from_right' as const,
    animationDuration: 250,
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? WarmDarkTheme : WarmLightTheme}>
      <StatusBar style="auto" />
      <OfflineBanner />
      <DeepLinkHandler />
      <NotificationHandler />
      <Stack
        screenOptions={screenOptions}
        initialRouteName={hasOnboarded ? '(tabs)' : 'onboarding'}
      >
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="create" options={{ title: 'Create Dinner' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event', headerShown: false }} />
        <Stack.Screen name="event/[id]/bell" options={{ title: 'Dinner Bell', headerShown: false }} />
        <Stack.Screen name="event/[id]/edit" options={{ title: 'Edit Event' }} />
        <Stack.Screen name="invite/[id]" options={{ title: 'Invite', headerShown: false }} />
        <Stack.Screen name="groups" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]/recap" options={{ title: 'Recap', headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: 'Sign in', headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </ThemeProvider>
  );
}

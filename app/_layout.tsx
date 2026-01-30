import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { DeepLinkHandler } from '@/components/DeepLinkHandler';
import { NotificationHandler } from '@/components/NotificationHandler';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Custom warm themes extending the default
const WarmLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#C79A2B',
    background: '#FAF7F2',
    card: '#FAF7F2',
    text: '#1B1B1B',
    border: '#E8E1D8',
  },
};

const WarmDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#E8C547',
    background: '#2C2419',
    card: '#2C2419',
    text: '#F5EFE6',
    border: '#5C5346',
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

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
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <RootLayoutNav />
      </ToastProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
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
  };

  return (
    <ThemeProvider value={colorScheme === 'dark' ? WarmDarkTheme : WarmLightTheme}>
      <DeepLinkHandler />
      <NotificationHandler />
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="create" options={{ title: 'Create Dinner' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="event/[id]/bell" options={{ title: 'Dinner Bell', headerShown: false }} />
        <Stack.Screen name="event/[id]/edit" options={{ title: 'Edit Event' }} />
        <Stack.Screen name="invite/[id]" options={{ title: 'Invite' }} />
        <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

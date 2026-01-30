import { supabase } from '@/lib/supabase';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

function isWeb(): boolean {
  return Platform.OS === 'web' || typeof window === 'undefined';
}

if (!isWeb()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isWeb()) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== 'granted') return null;
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch {
    return null;
  }
}

export async function savePushToken(token: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !token) return;
  await (supabase as any).from('profiles').update({ push_token: token, updated_at: new Date().toISOString() }).eq('id', user.id);
}

export function addNotificationResponseListener(callback: (response: Notifications.NotificationResponse) => void): () => void {
  if (isWeb()) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(callback);
  return () => sub.remove();
}

export function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  if (isWeb()) return Promise.resolve(null);
  return Notifications.getLastNotificationResponseAsync();
}

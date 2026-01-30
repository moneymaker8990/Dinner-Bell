import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export function NotificationHandler() {
  const router = useRouter();
  const { user } = useAuth();
  const mounted = useRef(false);

  useEffect(() => {
    if (isWeb || !user) return;
    import('@/lib/notifications').then(({ registerForPushNotificationsAsync, savePushToken }) => {
      registerForPushNotificationsAsync().then((token) => {
        if (token) savePushToken(token);
      });
    });
  }, [user?.id]);

  useEffect(() => {
    if (isWeb) return;
    import('@/lib/notifications').then(({ getLastNotificationResponse }) => {
      getLastNotificationResponse().then((response) => {
        if (!response || mounted.current) return;
        const data = response.notification.request.content.data as { type?: string; eventId?: string; message?: string };
        if (data?.eventId) {
          if (data.type === 'bell_ring') {
            const q = data.message ? `?message=${encodeURIComponent(data.message)}` : '';
            router.replace(`/event/${data.eventId}/bell${q}`);
          } else if (data.type === 'invite_received' || data.type === 'reminder') {
            router.replace(`/event/${data.eventId}`);
          }
        }
      });
    });
    mounted.current = true;
  }, []);

  useEffect(() => {
    if (isWeb) return;
    let unsub: (() => void) | undefined;
    import('@/lib/notifications').then(({ addNotificationResponseListener }) => {
      unsub = addNotificationResponseListener((response) => {
        const data = response.notification.request.content.data as { type?: string; eventId?: string; message?: string };
        if (data?.eventId) {
          if (data.type === 'bell_ring') {
            const q = data.message ? `?message=${encodeURIComponent(data.message)}` : '';
            router.push(`/event/${data.eventId}/bell${q}`);
          } else if (data.type === 'invite_received' || data.type === 'reminder') {
            router.push(`/event/${data.eventId}`);
          }
        }
      });
    });
    return () => {
      unsub?.();
    };
  }, [router]);

  return null;
}

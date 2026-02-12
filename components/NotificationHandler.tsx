import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
const BELL_SNOOZE_KEY = (eid: string) => `bell_snooze_${eid}`;
const BELL_MUTE_KEY = (eid: string) => `bell_mute_${eid}`;

export function NotificationHandler() {
  const router = useRouter();
  const { user } = useAuth();
  const mounted = useRef(false);

  useEffect(() => {
    if (isWeb || !user) return;
    import('@/lib/notifications').then(({ registerForPushNotificationsAsync, savePushToken }) => {
      registerForPushNotificationsAsync().then((token) => {
        if (token) savePushToken(token);
      }).catch(() => {});
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (isWeb) return;
    import('@/lib/notifications').then(({ getLastNotificationResponse }) => {
      getLastNotificationResponse().then(async (response) => {
        if (!response || mounted.current) return;
        const data = response.notification.request.content.data as {
          type?: string;
          eventId?: string;
          message?: string;
          bellSound?: string;
          token?: string;
          guestId?: string;
          action?: string;
          email?: string;
          phone?: string;
        };
        if (data?.eventId) {
          if (data.type === 'bell_ring') {
            const snooze = await AsyncStorage.getItem(BELL_SNOOZE_KEY(data.eventId));
            const mute = await AsyncStorage.getItem(BELL_MUTE_KEY(data.eventId));
            if (mute === 'true') return;
            if (snooze && parseInt(snooze, 10) > Date.now()) return;
            const q = new URLSearchParams();
            if (data.message) q.set('message', data.message);
            if (data.bellSound) q.set('sound', data.bellSound);
            router.replace(`/event/${data.eventId}/bell?${q.toString()}`);
          } else if (data.type === 'invite_received' && data.token) {
            const params = new URLSearchParams({ token: data.token });
            if (data.email) params.set('email', data.email);
            if (data.phone) params.set('phone', data.phone);
            if (data.action) params.set('action', data.action);
            router.replace(`/invite/${data.eventId}?${params.toString()}`);
          } else if (data.type === 'invite_received' || data.type === 'reminder') {
            const params = new URLSearchParams();
            if (data.guestId) params.set('guestId', data.guestId);
            if (data.action) params.set('action', data.action);
            const suffix = params.toString() ? `?${params.toString()}` : '';
            router.replace(`/event/${data.eventId}${suffix}`);
          }
        }
      }).catch(() => {});
    }).catch(() => {});
    mounted.current = true;
  }, []);

  useEffect(() => {
    if (isWeb) return;
    let unsub: (() => void) | undefined;
    import('@/lib/notifications').then(({ addNotificationResponseListener }) => {
      unsub = addNotificationResponseListener(async (response) => {
        const data = response.notification.request.content.data as {
          type?: string;
          eventId?: string;
          message?: string;
          bellSound?: string;
          token?: string;
          guestId?: string;
          action?: string;
          email?: string;
          phone?: string;
        };
        if (data?.eventId) {
          if (data.type === 'bell_ring') {
            const snooze = await AsyncStorage.getItem(BELL_SNOOZE_KEY(data.eventId));
            const mute = await AsyncStorage.getItem(BELL_MUTE_KEY(data.eventId));
            if (mute === 'true') return;
            if (snooze && parseInt(snooze, 10) > Date.now()) return;
            const q = new URLSearchParams();
            if (data.message) q.set('message', data.message);
            if (data.bellSound) q.set('sound', data.bellSound);
            router.push(`/event/${data.eventId}/bell?${q.toString()}`);
          } else if (data.type === 'invite_received' && data.token) {
            const params = new URLSearchParams({ token: data.token });
            if (data.email) params.set('email', data.email);
            if (data.phone) params.set('phone', data.phone);
            if (data.action) params.set('action', data.action);
            router.push(`/invite/${data.eventId}?${params.toString()}`);
          } else if (data.type === 'invite_received' || data.type === 'reminder') {
            const params = new URLSearchParams();
            if (data.guestId) params.set('guestId', data.guestId);
            if (data.action) params.set('action', data.action);
            const suffix = params.toString() ? `?${params.toString()}` : '';
            router.push(`/event/${data.eventId}${suffix}`);
          }
        }
      });
    }).catch(() => {});
    return () => {
      unsub?.();
    };
  }, [router]);

  return null;
}

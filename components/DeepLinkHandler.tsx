import * as Linking from 'expo-linking';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { Copy } from '@/constants/Copy';
import { useToast } from '@/contexts/ToastContext';
import { trackDeepLinkOpened } from '@/lib/analytics';

export function DeepLinkHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = Linking.parse(url);
      const path = (parsed.path ?? '').replace(/^\/+/, '');
      const query = parsed.queryParams ?? {};
      const action = (query?.action as string) ?? '';
      const guestId = (query?.guestId as string) ?? '';
      let target: string | null = null;
      let isInviteAttempt = false;
      let isEventAttempt = false;

      if (path.startsWith('invite/')) {
        isInviteAttempt = true;
        const id = path.replace('invite/', '').split('/')[0];
        const token = (query?.token as string) ?? '';
        if (id && token) {
          const params = new URLSearchParams({ token });
          if (action) params.set('action', action);
          if (guestId) params.set('guestId', guestId);
          target = `/invite/${id}?${params.toString()}`;
        }
      } else if (path.startsWith('event/')) {
        isEventAttempt = true;
        const parts = path.replace('event/', '').split('/');
        const id = parts[0];
        if (id && parts[1] === 'bell') {
          const message = (query?.message as string) ?? '';
          const q = message ? `?message=${encodeURIComponent(message)}` : '';
          target = `/event/${id}/bell${q}`;
        } else if (id && parts[1] === 'recap') {
          target = `/event/${id}/recap`;
        } else if (id && parts[1] === 'edit') {
          target = `/event/${id}/edit`;
        } else if (id) {
          const params = new URLSearchParams();
          if (guestId) params.set('guestId', guestId);
          if (action) params.set('action', action);
          target = params.toString() ? `/event/${id}?${params.toString()}` : `/event/${id}`;
        }
      } else if (path.startsWith('groups/')) {
        const id = path.replace('groups/', '').split('/')[0];
        if (id) {
          target = `/groups/${id}`;
        }
      } else if (path === 'groups') {
        target = '/groups';
      } else if (path === 'create') {
        target = '/create';
      } else if (path === 'sign-in') {
        target = '/sign-in';
      }

      if (!target) {
        const message = isInviteAttempt ? Copy.deepLink.invalidInvite : isEventAttempt ? Copy.deepLink.linkError : null;
        if (message) {
          toast.show(message);
          router.replace('/(tabs)' as any);
        }
        return;
      }

      const current = pathnameRef.current ?? '';
      const currentNormalized = current.split('?')[0];
      const targetNormalized = target.split('?')[0];
      if (currentNormalized === targetNormalized) return;
      trackDeepLinkOpened(path);
      router.replace(target as any);
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    if (Platform.OS === 'web') {
      return;
    }
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, [router, toast]);

  return null;
}

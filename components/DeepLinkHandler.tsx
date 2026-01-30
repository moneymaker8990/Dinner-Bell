import * as Linking from 'expo-linking';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export function DeepLinkHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = Linking.parse(url);
      const path = (parsed.path ?? '').replace(/^\/+/, '');
      const query = parsed.queryParams ?? {};
      let target: string | null = null;
      if (path.startsWith('invite/')) {
        const id = path.replace('invite/', '').split('/')[0];
        const token = (query?.token as string) ?? '';
        if (id && token) target = `/invite/${id}?token=${token}`;
      } else if (path.startsWith('event/')) {
        const parts = path.replace('event/', '').split('/');
        const id = parts[0];
        if (id && parts[1] === 'bell') target = `/event/${id}/bell`;
        else if (id) target = `/event/${id}`;
      }
      if (!target) return;
      const current = pathnameRef.current ?? '';
      const currentNormalized = current.split('?')[0];
      const targetNormalized = target.split('?')[0];
      if (currentNormalized === targetNormalized) return;
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
  }, [router]);

  return null;
}

import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = Linking.parse(url);
      const path = parsed.path ?? '';
      const query = parsed.queryParams ?? {};
      if (path.startsWith('invite/')) {
        const id = path.replace('invite/', '').split('/')[0];
        const token = (query?.token as string) ?? '';
        if (id && token) router.replace(`/invite/${id}?token=${token}`);
      } else if (path.startsWith('event/')) {
        const parts = path.replace('event/', '').split('/');
        const id = parts[0];
        if (id && parts[1] === 'bell') router.replace(`/event/${id}/bell`);
        else if (id) router.replace(`/event/${id}`);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, [router]);

  return null;
}

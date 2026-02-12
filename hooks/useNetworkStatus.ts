import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Returns current network connectivity state.
 * Uses @react-native-community/netinfo on native; navigator.onLine on web.
 */
export function useNetworkStatus(): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const update = () => setIsConnected(navigator.onLine);
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      setIsConnected(navigator.onLine);
      return () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }

    // Native: use NetInfo
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    // Fetch initial state
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  return { isConnected };
}

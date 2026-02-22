import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Placeholders allow static export (e.g. Vercel build) to succeed when env vars are not yet set.
// Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in Vercel for real data.
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// During SSR (e.g. Expo web) window is undefined; AsyncStorage touches window and crashes.
// Use a no-op storage so the client can render, then the browser will use AsyncStorage.
const isServer = typeof window === 'undefined';
const storage = isServer
  ? {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    }
  : AsyncStorage;

// Use untyped client here; our hand-maintained schema types can drift during migrations
// and should not block core invite/create flows at compile time.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

const devEmail = process.env.EXPO_PUBLIC_DEV_EMAIL ?? '';
const devPassword = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? '';
const showDevSignIn = __DEV__ && !!devEmail && !!devPassword;

export default function SignInScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (e) {
      setError(e.message);
      return;
    }
    router.back();
  };

  const handleDevSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email: devEmail, password: devPassword });
    setLoading(false);
    if (e) {
      setError(e.message);
      return;
    }
    router.back();
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (e) {
      setError(e.message);
      return;
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.inputBorder }]}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={[styles.input, { borderColor: colors.inputBorder }]}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.button, { backgroundColor: colors.primaryButton }, loading && styles.buttonDisabled]} onPress={handleSignIn} disabled={loading}>
        <Text style={[styles.buttonText, { color: colors.primaryButtonText }]}>Sign in</Text>
      </Pressable>
      <Pressable style={[styles.buttonSecondary, loading && styles.buttonDisabled]} onPress={handleSignUp} disabled={loading}>
        <Text style={[styles.buttonSecondaryText, { color: colors.tint }]}>Create account</Text>
      </Pressable>
      {showDevSignIn && (
        <Pressable style={[styles.devButton, { backgroundColor: colors.secondaryText }, loading && styles.buttonDisabled]} onPress={handleDevSignIn} disabled={loading}>
          <Text style={[styles.devButtonText, { color: colors.primaryButtonText }]}>Dev sign in</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 },
  error: { color: '#c00', marginBottom: 12 },
  button: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { fontWeight: '600' },
  buttonSecondary: { padding: 16, alignItems: 'center', marginTop: 8 },
  buttonSecondaryText: { fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  devButton: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  devButtonText: { fontWeight: '600' },
});

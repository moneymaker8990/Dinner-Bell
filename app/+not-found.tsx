import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { Copy } from '@/constants/Copy';
import Colors from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';

export default function NotFoundScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>{Copy.notFound.title}</Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.primaryBrand }]}>{Copy.notFound.goHome}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: 'bold',
  },
  link: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
  },
  linkText: {
    fontSize: typography.meta,
  },
});

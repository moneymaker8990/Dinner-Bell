import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { lineHeight, spacing, typography } from '@/constants/Theme';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TermsOfServiceScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Terms of Service</Text>
      <Text style={[styles.updatedAt, { color: colors.textSecondary }]}>Last updated: February 2026</Text>

      <Section title="Acceptance" body="By using Dinner Bell, you agree to these terms and to use the app in compliance with applicable laws and platform rules." colors={colors} />
      <Section title="Account responsibilities" body="You are responsible for your account activity and for keeping your sign-in credentials secure." colors={colors} />
      <Section title="User content" body="You retain ownership of event details and content you submit. You grant us permission to process that content to provide app functionality." colors={colors} />
      <Section title="Service availability" body="We may update, change, or discontinue features to improve reliability, security, or user experience." colors={colors} />
      <Section title="Contact" body="For questions about these terms, contact support@dinnerbell.app." colors={colors} />
    </ScrollView>
  );
}

function Section({
  title,
  body,
  colors,
}: {
  title: string;
  body: string;
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  title: {
    fontSize: typography.display,
    lineHeight: lineHeight.title,
    fontWeight: '700',
  },
  updatedAt: {
    fontSize: typography.meta,
    lineHeight: lineHeight.meta,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.headline,
    lineHeight: lineHeight.headline,
    fontWeight: '600',
  },
  body: {
    fontSize: typography.body,
    lineHeight: lineHeight.body,
  },
});

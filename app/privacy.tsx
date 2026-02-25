import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { lineHeight, spacing, typography } from '@/constants/Theme';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PrivacyPolicyScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
      <Text style={[styles.updatedAt, { color: colors.textSecondary }]}>Last updated: February 2026</Text>

      <Section title="What we collect" body="Dinner Bell may collect account identifiers, profile info, event details, guest RSVP responses, and optional contact/calendar data when you grant permission." colors={colors} />
      <Section title="How we use data" body="We use data to provide core app functionality: creating events, inviting guests, sending notifications, and improving app reliability and performance." colors={colors} />
      <Section title="Permissions" body="Contacts and calendar permissions are only used to power invite and scheduling features. You can deny or revoke permissions in device settings at any time." colors={colors} />
      <Section title="Data sharing" body="We do not sell personal information. Service providers may process data on our behalf for hosting, notifications, and analytics needed to run Dinner Bell." colors={colors} />
      <Section title="Support" body="For privacy questions, contact support@dinnerbell.app." colors={colors} />
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

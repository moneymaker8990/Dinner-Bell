import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fontFamily, fontWeight, gradients, letterSpacing, spacing, typography } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface GradientHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  children?: React.ReactNode;
  /** Height of the header. Defaults to 220. */
  height?: number;
  /** Custom gradient colors [start, end]. Falls back to theme gradient tokens. */
  colors?: [string, string];
  /** Optional cover image URL — displayed behind a dark overlay when provided */
  coverImageUrl?: string | null;
}

/**
 * Premium hero header with linear gradient background, title/subtitle slots,
 * and optional back button. Uses gradient tokens from Colors.ts.
 */
export function GradientHeader({
  title,
  subtitle,
  onBack,
  children,
  height = 220,
  colors: customColors,
  coverImageUrl,
}: GradientHeaderProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const gradientColors = customColors ?? [c.gradientStart, c.gradientEnd];

  return (
    <View style={[styles.outerContainer, { height }]}>
      {coverImageUrl ? (
        <>
          <Image
            source={{ uri: coverImageUrl }}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.imageOverlay]} />
        </>
      ) : (
        <LinearGradient
          colors={gradientColors}
          start={gradients.hero.start}
          end={gradients.hero.end}
          style={StyleSheet.absoluteFill}
        />
      )}
      {onBack && (
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={c.onGradient} />
        </Pressable>
      )}
      <View style={styles.content}>
        {children}
        {title && (
          <Text
            style={[styles.title, { color: c.onGradient }]}
            accessibilityRole="header"
            numberOfLines={2}
          >
            {title}
          </Text>
        )}
        {subtitle && (
          <Text style={[styles.subtitle, { color: c.onGradientMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    overflow: 'hidden',
  },
  imageOverlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    gap: spacing.xs,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: typography.title,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.title,
  },
  subtitle: {
    fontSize: typography.body,
    fontWeight: fontWeight.regular,
  },
});

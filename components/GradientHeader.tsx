import { BrandLogo } from '@/components/BrandLogo';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fontFamily, fontWeight, letterSpacing, radius, spacing, typography } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface GradientHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  children?: React.ReactNode;
  /** Height of the header. Defaults to 220. */
  height?: number;
  /** Backward compatibility prop (unused in Night Mode). */
  colors?: [string, string];
  /** Optional cover image URL — displayed behind a dark overlay when provided */
  coverImageUrl?: string | null;
  /** Optional compact brand mark for premium header contexts */
  showBrandLogo?: boolean;
}

/**
 * Premium hero header with solid dark background, title/subtitle slots,
 * and optional back button.
 */
export function GradientHeader({
  title,
  subtitle,
  onBack,
  children,
  height = 220,
  colors: _customColors,
  coverImageUrl,
  showBrandLogo = false,
}: GradientHeaderProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View style={[styles.outerContainer, { height, backgroundColor: c.background, borderBottomColor: c.border }]}>
      {coverImageUrl ? (
        <>
          <Image
            source={{ uri: coverImageUrl }}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} />
        </>
      ) : (
        <View style={StyleSheet.absoluteFill} />
      )}
      {onBack && (
        <Pressable
          onPress={onBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
        </Pressable>
      )}
      {showBrandLogo && (
        <View style={[styles.logoWrap, onBack ? styles.logoWrapWithBack : null]}>
          <BrandLogo size={26} variant="default" />
        </View>
      )}
      <View style={styles.content}>
        {children}
        {title && (
          <Text
            style={[styles.title, { color: c.textPrimary }]}
            accessibilityRole="header"
            numberOfLines={2}
          >
            {title}
          </Text>
        )}
        {subtitle && (
          <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

export const Header = GradientHeader;

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    overflow: 'hidden',
    borderBottomWidth: 1,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: radius.card,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    gap: spacing.xs,
  },
  logoWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 62 : 46,
    left: spacing.xl,
    zIndex: 9,
  },
  logoWrapWithBack: {
    left: spacing.xl + 38,
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

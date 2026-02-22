import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fontFamily, letterSpacing } from '@/constants/Theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type BrandLogoVariant = 'default' | 'primary' | 'muted';

interface BrandLogoProps {
  size: number;
  variant?: BrandLogoVariant;
  showWordmark?: boolean;
  color?: string;
}

function resolveColor(
  variant: BrandLogoVariant | undefined,
  explicitColor: string | undefined,
  colors: (typeof Colors)['light']
): string {
  if (explicitColor) return explicitColor;
  if (variant === 'primary') return colors.primaryBrand;
  if (variant === 'muted') return colors.textSecondary;
  return colors.textPrimary;
}

export function BrandLogo({
  size,
  variant = 'default',
  showWordmark = false,
  color,
}: BrandLogoProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const stroke = resolveColor(variant, color, colors);

  const iconWidth = size;
  const iconHeight = size * 1.12;
  const strokeWidth = Math.max(1.5, size * 0.1);
  const clapperRadius = Math.max(1.4, size * 0.085);

  return (
    <View style={[styles.row, showWordmark ? styles.withWordmark : null]}>
      <Svg width={iconWidth} height={iconHeight} viewBox="0 0 100 112" fill="none">
        <Path
          d="M24 61 C24 39 34 21 50 17 C66 21 76 39 76 61 L76 69 C76 75 80 80 86 82 L14 82 C20 80 24 75 24 69 Z"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx="50" cy="66" r={clapperRadius} fill={stroke} />
        <Path
          d="M18 98 C33 88 67 88 82 98"
          stroke={stroke}
          strokeWidth={Math.max(1.5, strokeWidth * 0.4)}
          strokeLinecap="round"
        />
      </Svg>
      {showWordmark ? (
        <Text style={[styles.wordmark, { color: stroke, fontSize: Math.max(14, size * 0.36) }]}>
          Dinner Bell
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  withWordmark: {
    flexDirection: 'row',
    gap: 8,
  },
  wordmark: {
    fontFamily: fontFamily.body,
    fontWeight: '800',
    letterSpacing: letterSpacing.title,
  },
});

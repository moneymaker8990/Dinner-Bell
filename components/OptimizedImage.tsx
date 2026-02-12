import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { radius } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageProps, type ImageSource } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  /** Image source (uri, require, etc.) */
  source: ImageSource | string;
  /** Blurhash placeholder string for progressive loading */
  blurhash?: string;
  /** Width of the image */
  width?: number;
  /** Height of the image */
  height?: number;
  /** Border radius. Defaults to radius.card. */
  borderRadius?: number;
  /** Show fallback icon when image fails to load */
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Premium image component wrapping expo-image with:
 * - Blurhash placeholder for progressive loading
 * - Cross-fade transition on load
 * - Error fallback with icon
 * - Optimized caching
 */
export function OptimizedImage({
  source,
  blurhash,
  width,
  height,
  borderRadius: customRadius,
  fallbackIcon = 'image-outline',
  style,
  ...rest
}: OptimizedImageProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const br = customRadius ?? radius.card;
  const [hasError, setHasError] = useState(false);

  const imageSource: ImageSource =
    typeof source === 'string' ? { uri: source } : source;

  const hasValidSource =
    typeof source === 'string' ? source.length > 0 : !!source;

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius: br,
          backgroundColor: c.surface2,
        },
        style as any,
      ]}
    >
      {hasError || !hasValidSource ? (
        <View style={[styles.fallbackContainer, { width, height }]}>
          <Ionicons
            name={fallbackIcon}
            size={Math.min(width ?? 24, height ?? 24) * 0.4}
            color={c.placeholder}
          />
        </View>
      ) : (
        <Image
          source={imageSource}
          placeholder={blurhash ? { blurhash } : undefined}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
          onError={() => setHasError(true)}
          style={[
            styles.image,
            {
              width,
              height,
              borderRadius: br,
            },
          ]}
          {...rest}
        />
      )}
    </View>
  );
}

/** Circular avatar variant of OptimizedImage */
export function OptimizedAvatar({
  source,
  size = 40,
  blurhash,
  fallbackIcon = 'person',
  ...rest
}: Omit<OptimizedImageProps, 'width' | 'height' | 'borderRadius'> & {
  size?: number;
}) {
  return (
    <OptimizedImage
      source={source}
      width={size}
      height={size}
      borderRadius={size / 2}
      blurhash={blurhash}
      fallbackIcon={fallbackIcon}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

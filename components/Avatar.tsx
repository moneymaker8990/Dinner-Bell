import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface AvatarProps {
  initials: string;
  avatarUrl?: string | null;
  size?: number;
  style?: ViewStyle;
}

export const Avatar = React.memo(function Avatar({ initials, avatarUrl, size = 64, style }: AvatarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const fontSize = Math.max(14, size * 0.4);

  const containerStyle = [
    styles.avatar,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.tint + '40',
    },
    style,
  ];

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[containerStyle, styles.image]}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={[styles.initials, { color: colors.tint, fontSize }]} numberOfLines={1}>
        {initials.toUpperCase().slice(0, 2)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '600',
  },
});

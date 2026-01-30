import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface AvatarProps {
  initials: string;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ initials, size = 64, style }: AvatarProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const fontSize = Math.max(14, size * 0.4);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.tint + '40',
        },
        style,
      ]}>
      <Text style={[styles.initials, { color: colors.tint, fontSize }]} numberOfLines={1}>
        {initials.toUpperCase().slice(0, 2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '600',
  },
});

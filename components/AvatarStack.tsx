import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { spacing } from '@/constants/Theme';
import { StyleSheet, ViewStyle } from 'react-native';

interface AvatarStackProps {
  initials: string[];
  size?: number;
  max?: number;
  style?: ViewStyle;
}

export function AvatarStack({ initials, size = 32, max = 4, style }: AvatarStackProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const fontSize = Math.max(10, size * 0.38);
  const overlap = size * 0.3;
  const visible = initials.slice(0, max);
  const remaining = initials.length - max;

  return (
    <View style={[styles.wrapper, style]}>
      {visible.map((init, i) => (
        <View
          key={i}
          style={[
            styles.circle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.tint + '30',
              borderColor: colors.card,
              marginLeft: i === 0 ? 0 : -overlap,
              zIndex: visible.length - i,
            },
          ]}
        >
          <Text style={[styles.initials, { color: colors.tint, fontSize }]}>
            {init.toUpperCase().slice(0, 2)}
          </Text>
        </View>
      ))}
      {remaining > 0 && (
        <View
          style={[
            styles.circle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.border,
              borderColor: colors.card,
              marginLeft: -overlap,
              zIndex: 0,
            },
          ]}
        >
          <Text style={[styles.initials, { color: colors.textSecondary, fontSize }]}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  initials: {
    fontWeight: '600',
  },
});

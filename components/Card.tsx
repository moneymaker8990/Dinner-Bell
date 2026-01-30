import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { cardShadow, radius, spacing } from '@/constants/Theme';
import { StyleSheet, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View
      style={[
        styles.card,
        cardShadow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: radius.card,
        },
        style,
      ]}
      lightColor={colors.card}
      darkColor={colors.card}>
      {children}
    </View>
  );
}

interface CardHeaderProps {
  title?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function CardHeader({ title, children, style }: CardHeaderProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }, style]} lightColor={colors.card} darkColor={colors.card}>
      {title != null && <Text style={[styles.headerTitleText, { color: colors.textPrimary }]}>{title}</Text>}
      {children}
    </View>
  );
}

export function CardBody({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  return (
    <View style={[styles.body, style]} lightColor={colors.card} darkColor={colors.card}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    padding: spacing.lg,
  },
});

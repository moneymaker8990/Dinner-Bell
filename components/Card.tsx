import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getElevation, radius, spacing, typography } from '@/constants/Theme';
import { StyleSheet, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Card({ children, style }: CardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View
      style={[
        styles.card,
        getElevation('floating', colors.shadow),
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(colors.primaryBrand, colorScheme === 'dark' ? 0.28 : 0.16),
          borderRadius: radius.card,
          shadowColor: colors.shadow,
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
    fontSize: typography.h3,
    fontWeight: '600',
  },
  body: {
    padding: spacing.lg,
  },
});

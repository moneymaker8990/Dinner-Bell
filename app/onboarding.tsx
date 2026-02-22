import { AnimatedPressable } from '@/components/AnimatedPressable';
import { BrandLogo } from '@/components/BrandLogo';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fontFamily, fontWeight, letterSpacing, lineHeight, radius, spacing, typography } from '@/constants/Theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    View,
    ViewToken,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ONBOARDING_KEY = 'hasOnboarded';

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  title: string;
  body: string;
}

function getSlides(colors: typeof Colors['light']): OnboardingSlide[] {
  return [
    {
      id: '1',
      icon: 'notifications-outline',
      iconColor: colors.brandGold,
      iconBgColor: colors.brandGoldFaint,
      title: 'Ring the bell',
      body: 'Gather your people for dinner. One tap sends the signal — dinner is ready.',
    },
    {
      id: '2',
      icon: 'people-outline',
      iconColor: colors.brandSage,
      iconBgColor: colors.brandSageFaint,
      title: 'Plan together',
      body: 'Menu, bring list, and RSVP — everything your guests need in one place.',
    },
    {
      id: '3',
      icon: 'restaurant-outline',
      iconColor: colors.brandAmber,
      iconBgColor: colors.brandAmberFaint,
      title: 'Time to eat',
      body: 'Ring the bell when dinner is ready. Everyone gets notified instantly.',
    },
  ];
}

export default function OnboardingScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const reduceMotion = useReducedMotion();
  const slides = getSlides(c);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(tabs)');
  };

  const isLast = currentIndex === slides.length - 1;

  const renderItem = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <View style={styles.slide}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(200).duration(500)}
        style={styles.slideContent}
      >
        <View style={[styles.iconCircle, { backgroundColor: item.iconBgColor }]}>
          <Ionicons name={item.icon} size={64} color={item.iconColor} />
        </View>
        <Text style={[styles.slideTitle, { color: c.textPrimary }]}>{item.title}</Text>
        <Text style={[styles.slideBody, { color: c.textSecondary }]}>{item.body}</Text>
      </Animated.View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Logo */}
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(600)}
        style={styles.logoArea}
      >
        <BrandLogo size={48} variant="primary" showWordmark />
      </Animated.View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === currentIndex ? c.primaryBrand : c.border,
                width: i === currentIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {!isLast && (
          <AnimatedPressable variant="ghost" enableHaptics onPress={handleSkip} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: c.textSecondary }]}>Skip</Text>
          </AnimatedPressable>
        )}
        <AnimatedPressable
          variant="primary"
          enableHaptics
          style={[
            styles.nextBtn,
            { backgroundColor: c.primaryButton },
          ]}
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Get Started' : 'Next'}
        >
          <Text style={[styles.nextBtnText, { color: c.primaryButtonText }]}>
            {isLast ? 'Get Started' : 'Next'}
          </Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoArea: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: spacing.lg,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl + spacing.lg,
  },
  slideContent: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  slideTitle: {
    fontFamily: fontFamily.display,
    fontSize: typography.title,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: letterSpacing.title,
  },
  slideBody: {
    fontSize: typography.body,
    fontWeight: fontWeight.regular,
    textAlign: 'center',
    lineHeight: lineHeight.body,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
  },
  skipBtn: {
    padding: spacing.md,
  },
  skipText: {
    fontSize: typography.body,
    fontWeight: fontWeight.medium,
  },
  nextBtn: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl + spacing.md,
    borderRadius: radius.button,
    marginLeft: 'auto',
  },
  nextBtnText: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.subtitle,
  },
});

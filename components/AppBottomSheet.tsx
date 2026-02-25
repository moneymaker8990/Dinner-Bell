import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fontWeight, radius, spacing, typography, zIndex } from '@/constants/Theme';
import GorhomBottomSheet, {
    BottomSheetBackdrop,
    BottomSheetScrollView,
    BottomSheetView,
    type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AppBottomSheetProps {
  /** Snap points as percentages or pixel values, e.g. ['50%', '90%'] */
  snapPoints?: (string | number)[];
  /** Called when sheet is fully dismissed */
  onClose?: () => void;
  /** Title shown in the handle area */
  title?: string;
  /** Use scrollable inner view (for long content) */
  scrollable?: boolean;
  children: React.ReactNode;
  /** Initial snap index. -1 = closed. Defaults to 0. */
  index?: number;
}

/**
 * Premium bottom sheet wrapping @gorhom/bottom-sheet with theme-aware styling,
 * handle indicator, backdrop blur, and snap points.
 * Replaces all <Modal> usage across the app.
 */
export const AppBottomSheet = forwardRef<GorhomBottomSheet, AppBottomSheetProps>(
  function AppBottomSheet(
    {
      snapPoints: customSnapPoints,
      onClose,
      title,
      scrollable = false,
      children,
      index = 0,
    },
    ref
  ) {
    const scheme = useColorScheme() ?? 'light';
    const c = Colors[scheme];

    const snapPoints = useMemo(
      () => customSnapPoints ?? ['50%', '90%'],
      [customSnapPoints]
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    const ContentWrapper = scrollable ? BottomSheetScrollView : BottomSheetView;

    return (
      <GorhomBottomSheet
        ref={ref}
        index={index}
        snapPoints={snapPoints}
        onClose={onClose}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={[
          styles.handleIndicator,
          { backgroundColor: c.richNeutralMuted },
        ]}
        backgroundStyle={[
          styles.background,
          { backgroundColor: c.elevatedSurface },
        ]}
        style={styles.sheet}
      >
        {title && (
          <View style={[styles.header, { borderBottomColor: c.border }]}>
            <Text
              style={[styles.headerTitle, { color: c.textPrimary }]}
              accessibilityRole="header"
            >
              {title}
            </Text>
          </View>
        )}
        <ContentWrapper style={styles.content}>{children}</ContentWrapper>
      </GorhomBottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  sheet: {
    zIndex: zIndex.modal,
  },
  background: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  handleIndicator: {
    width: 36,
    height: 4,
    borderRadius: radius.chip,
    opacity: 0.4,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: typography.headline,
    fontWeight: fontWeight.semibold,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
  },
});

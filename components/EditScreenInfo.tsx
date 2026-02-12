import React from 'react';
import { StyleSheet } from 'react-native';

import { ExternalLink } from './ExternalLink';
import { MonoText } from './StyledText';
import { Text, View } from './Themed';

import Colors from '@/constants/Colors';
import { spacing, typography } from '@/constants/Theme';

export default function EditScreenInfo({ path }: { path: string }) {
  return (
    <View>
      <View style={styles.getStartedContainer}>
        <Text
          style={styles.getStartedText}
          lightColor={Colors.light.textPrimary}
          darkColor={Colors.dark.textPrimary}>
          Open up the code for this screen:
        </Text>

        <View
          style={[styles.codeHighlightContainer, styles.homeScreenFilename]}
          darkColor={Colors.dark.surface2}
          lightColor={Colors.light.surface2}>
          <MonoText>{path}</MonoText>
        </View>

        <Text
          style={styles.getStartedText}
          lightColor={Colors.light.textPrimary}
          darkColor={Colors.dark.textPrimary}>
          Change any of the text, save the file, and your app will automatically update.
        </Text>
      </View>

      <View style={styles.helpContainer}>
        <ExternalLink
          style={styles.helpLink}
          href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet">
          <Text style={styles.helpLinkText} lightColor={Colors.light.tint}>
            Tap here if your app doesn't automatically update after making changes
          </Text>
        </ExternalLink>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  getStartedContainer: {
    alignItems: 'center',
    marginHorizontal: spacing.xxl + spacing.lg + 2,
  },
  homeScreenFilename: {
    marginVertical: spacing.sm,
  },
  codeHighlightContainer: {
    borderRadius: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  getStartedText: {
    fontSize: typography.body,
    lineHeight: spacing.xl,
    textAlign: 'center',
  },
  helpContainer: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg + spacing.xs,
    alignItems: 'center',
  },
  helpLink: {
    paddingVertical: spacing.lg,
  },
  helpLinkText: {
    textAlign: 'center',
  },
});

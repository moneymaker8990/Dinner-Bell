# Accessibility Checklist

## Contrast
- [ ] All text meets WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text)
- [ ] Interactive elements meet 3:1 contrast against adjacent colors
- [ ] Check both light and dark themes

## Touch Targets
- [ ] All interactive elements have at least 44x44pt touch target
- [ ] Buttons, links, and controls are easily tappable
- [ ] Sufficient spacing between adjacent touch targets

## Screen Reader / Labels
- [ ] All interactive elements have `accessibilityLabel` or meaningful text content
- [ ] Images have `accessibilityLabel` descriptions
- [ ] Decorative elements are hidden from screen readers (`accessibilityElementsHidden` or `importantForAccessibility="no"`)
- [ ] FAB has `accessibilityRole="button"` and `accessibilityLabel`

## Dynamic Type / Font Scaling
- [ ] Text scales appropriately with system font size settings
- [ ] Layout doesn't break at larger font sizes
- [ ] Use typography tokens (not hardcoded px) for all text

## Reduced Motion
- [ ] All animations respect `useReducedMotion` hook
- [ ] Skeleton loaders use static state when reduce-motion is on
- [ ] Hero animations skip to final state
- [ ] Toast appears/dismisses instantly

## Keyboard / Focus (Web)
- [ ] Tab order follows logical reading order
- [ ] Focus ring visible on focused elements (use `Theme.border.focusRing`)
- [ ] Modals trap focus when open
- [ ] Escape key closes modals

## Color Independence
- [ ] Information is not conveyed by color alone
- [ ] RSVP states have labels in addition to color accents
- [ ] Bring list status has text labels alongside color indicators

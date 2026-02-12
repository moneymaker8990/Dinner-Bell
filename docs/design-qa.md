# Design QA Checklist

Use this checklist to ensure the design system is the single source of truth. No raw hex or magic numbers in screens/components (except in `constants/Colors.ts` and template accent map).

## Token usage

- [ ] **Colors**: All UI color comes from `Colors[scheme].*` (e.g. `primaryBrand`, `elevation.shadow`, `rsvpGoing`). No `#RRGGBB` in app/components or screens.
- [ ] **Theme**: Spacing uses `Theme.spacing.*`, radius uses `Theme.radius.*`, typography uses `Theme.typography.*` or type ramp (`display`, `title`, `headline`, `body`, `meta`, `microLabel`).
- [ ] **Elevation**: Card/surface shadows use `getElevation(level, colors.shadow)` or merge `Theme.cardShadow` / `Theme.cardShadowSubtle` / `Theme.cardShadowHover` with `shadowColor: colors.shadow`.
- [ ] **Borders**: Border width uses `Theme.border.*` (hairline, subtle, medium, focusRing) where applicable.

## Audit commands

Run from repo root:

```bash
# Hardcoded hex (exclude constants/Colors.ts and lib/templates.ts THEME_ACCENT)
rg "#[0-9A-Fa-f]{6}" app components constants/Theme.ts --type-add 'source:*.{ts,tsx,js,jsx}' -t source

# Magic numbers for borderRadius (expect only Theme.radius or numbers from Theme)
rg "borderRadius:\s*[0-9]+" app components

# Shadow color hardcoded (should use colors.shadow)
rg "shadowColor:\s*['\"]#" app components
```

**Pass criteria**: No matches in `app/` or `components/` (or only in comments). `constants/Colors.ts` and `lib/templates.ts` THEME_ACCENT are the only allowed hex sources.

## Light/dark parity

- [ ] Every semantic color used in light exists in dark with appropriate contrast.
- [ ] Contrast check: text on background and interactive elements meet WCAG targets.

## Files that are the single source

- `constants/Colors.ts` – all color tokens (light + dark).
- `constants/Theme.ts` – spacing, radius, typography, letterSpacing, border, elevation specs, iconSize, gradients, glass.

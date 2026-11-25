# Proposal: Scalable Themes and Localization

## Goal

Evolve the current two-mode theme into a maintainable design system that can
support roughly 20 distinct, selectable visual themes in total, multiple
languages, and responsive layouts without duplicating styles or scattering
conditionals through screens. The first implementation will include three
themes (`light`, `dark`, and `neon`) and four locales.

The first implementation follows this proposal with three selectable themes
and four repository-managed locales. It does not create 20 placeholder themes
or locales before product requirements exist. Native iOS/Android appearance,
per-app language, and RTL behavior still require device or emulator QA.

## Design principles

1. **Keep theme, system default, locale, and layout separate.**
   - A **theme** is a complete visual identity, not just a color palette. It
     may define colors, typography, spacing, shapes, and optional assets.
   - **System** is a selection option that chooses the `light` or `dark` theme
     from device appearance when the user has not selected a theme.
   - **Locale** is a language/region identifier such as `en` or `fr-CA`.
   - **Responsive layout** depends on window dimensions and font scale, not on
     theme or language.
2. **Use semantic tokens.** Screens ask for `text.primary`, `surface`,
   `action.primary`, or `border`; they do not choose raw colors.
3. **Resolve configuration once.** Components consume a complete, typed
   theme and translation function rather than implementing fallback logic.
4. **Keep provider values stable.** Resolve and memoize theme values by theme
   ID and appearance. Keep responsive tokens separate so a resize does not
   rebuild the palette or invalidate unrelated context.
5. **Prefer static, reviewed resources.** Keep theme definitions and
   translations in the app bundle initially; translation files may be
   generated from an approved translation workflow. Defer remote theme
   delivery until a concrete product requirement justifies versioning,
   caching, and runtime validation.
6. **Keep defaults simple.** Share typography, spacing, and shapes by default.
   Let a theme override those tokens only when its visual identity requires
   it; do not copy all tokens for every theme.

## Proposed architecture

```text
App
└── AppPreferencesProvider
    └── ThemeProvider
        └── LocalizationProvider
            └── Screens
                ├── useTheme -> theme choice -> complete theme tokens
                ├── useTranslation -> locale -> translated strings/formatters
                └── useWindowDimensions -> responsive layout tokens
```

Theme and localization providers may be nested at the app root, but their
resolvers must remain independent. A language change must not select a theme,
a theme change must not alter the language, and responsive breakpoints must
not create additional theme variants.

### Suggested structure

```text
src/
  theme/
    types.ts
    registry.ts
    resolve-theme.ts
    ThemeProvider.tsx
    responsive.ts
  localization/
    i18n.ts
    locale.ts
    LocalizationProvider.tsx
    catalogs/
      en.json
      fr.json
      zh-Hans.json
      ja.json
  preferences/
    storage.ts
    AppPreferencesProvider.tsx
```

Use `useTranslation` from `react-i18next` directly; add a typed wrapper only
if it solves a real app-wide need. Keep the number of files proportional to
the implementation: the registry may import local theme definitions, and
catalogs may be grouped by feature or namespace as they grow. Do not create
empty modules for future themes or locales.

## Theme model

### IDs and definitions

- Give every theme a stable machine ID and a user-facing display name.
- Derive the `ThemeId` type from registry keys so adding a theme does not
  require editing a second list.
- Never reuse a retired ID. Keep an explicit migration or alias for persisted
  preferences when a theme is renamed or removed.
- Start with three complete theme definitions: `light`, `dark`, and `neon`.
  The target of roughly 20 means 20 distinct themes total, not 20 themes each
  duplicated into light/dark variants.
- Keep shared typography, spacing, radii, elevation, and motion tokens in a
  common foundation. Permit explicit, reviewed overrides for themes that need
  different visual aspects.
- Resolve each selection to a complete `ResolvedTheme`; components should not
  read optional overrides or perform palette fallbacks themselves.
- Allow theme-specific fonts or image assets only when a real theme requires
  them. Keep asset references typed and bundled.

A theme definition should be data, not a component or a chain of
`if (themeName === ...)` checks. Adding a theme should normally mean adding a
definition and tests, not editing every screen.

The registry should validate every definition at build/test time. Each theme
must produce the complete resolved token contract; components must not
implement missing-token fallbacks. In particular, adding a theme must not
require new theme-name conditionals in screens.

### Selection and persistence

Represent the user's theme choice separately from the system appearance used
for the default:

```ts
type ThemeChoice = ThemeId | 'system';
```

With no saved choice, use device appearance to select `light` or `dark`.
Provide an in-app selector for `system`, `light`, `dark`, and `neon`; persist
user selections behind a small storage adapter. Present the theme and language
selectors as compact dropdowns at the top-right of the main screen. Show the
resolved language as a two-letter code (`EN`, `FR`, `ZH`, or `JA`) while keeping
full language names in the dropdown. Resolve unknown or removed IDs through an
explicit migration and then to `system`. Tenant-assigned themes are not part
of this implementation.

The app declares automatic appearance in [`app.json`](../app.json) and includes
`expo-system-ui`. Keep that configuration aligned with the resolver, and
verify system appearance on native builds; the browser preview alone cannot
validate native system UI behavior.

### Responsive layout

Move width-dependent values out of the theme resolver. Use React Native's
`useWindowDimensions` to derive a small set of responsive layout tokens, such
as compact, regular, and wide content widths and padding. Typography should
respect system font scaling; do not make a separate copy of every theme for
each breakpoint. Keep content centered with a maximum readable width on large
screens and allow scrolling instead of fixed-height layouts on short screens
or when accessibility text is enlarged.

## Localization model

### Locale detection and fallback

- Use `expo-localization` to read the user's preferred locales. Prefer its
  `useLocales` hook when the app must react to locale changes while running;
  Android can update locale settings without restarting the app.
- Support `en` (default/fallback), `fr`, `zh-Hans`, and `ja` initially.
- Resolve locale in this order: a valid saved in-app override, the first
  supported platform/app locale, then `en`.
- Support platform per-app language settings where available. Do not build a
  language picker unless the product requires an in-app override. This
  implementation includes a language selector because users requested one.
- Store catalogs using BCP 47 locale IDs. Resolve regional variants to a
  supported base-language catalog when no exact regional catalog exists, then
  fall back to the default locale.
- Missing translations must fall back predictably and be reported in tests or
  development tooling; never show raw keys to users in production.

### Translation resources and API

Use a maintained React localization library, with `i18next` and
`react-i18next` as the proposed default, plus `expo-localization` for locale
detection. Confirm compatibility and versions during implementation. Keep
resources in locale- and feature/namespace-specific catalogs.

- Replace user-visible hard-coded strings with stable translation keys.
- Use interpolation and plural rules rather than concatenating translated
  fragments.
- Format numbers, dates, and other locale-sensitive values with locale-aware
  formatters such as `Intl.NumberFormat` and `Intl.DateTimeFormat`.
- Keep translation keys semantic and stable; do not use full English
  sentences as keys.
- Treat product names and other intentionally untranslated text explicitly.

### Right-to-left and text expansion

- Declare supported locales and RTL support through the `expo-localization`
  config plugin when implementing the first RTL locale. This is native
  build-time configuration; validate it in a rebuilt development/release app,
  not only in the web preview.
- Keep the plugin's `supportedLocales` list synchronized with shipped
  translation catalogs so platform language settings never offer an
  untranslated locale.
- Use logical layout directions (`start`/`end`) rather than hard-coded
  left/right alignment. Mirror directional icons only when their meaning
  requires it.
- Allow translated text to wrap and expand. Avoid fixed heights and verify
  long labels, accessibility font scaling, and narrow-screen layouts.

## Validation and testing

Add checks to the existing Jest/TypeScript workflow:

- **Theme registry:** IDs are unique; every theme returns all required visual
  tokens; system selection resolves to `light` or `dark`; unknown IDs use the
  documented fallback.
- **Accessibility:** For every theme and appearance mode, verify
  text/background contrast against WCAG AA targets: 4.5:1 for normal text and
  3:1 for large text. Verify 3:1 contrast for essential non-text control
  boundaries where applicable.
- **Responsive layout:** Test compact, regular, and wide widths, including
  longer text and larger font scale.
- **Localization:** Every required locale has the same keys per namespace;
  test locale selection, fallback, interpolation, pluralization, and
  number/date formatting.
- **RTL:** Test at least one RTL locale in a real device/emulator or a
  representative visual test; check alignment, text flow, and directional
  icons.
- **Screen behavior:** Continue testing through accessible interactions and
  visible output rather than theme implementation details.

Review visual snapshots for representative combinations, not all combinations
manually. Automated checks should cover every registered theme and locale's
required data; manual review can focus on the default theme, one strongly
contrasting theme, compact and wide layouts, enlarged text, and RTL. A web
preview is useful for layout iteration but does not replace native review of
system bars, per-app language settings, or RTL behavior.

## Incremental implementation plan

1. **Use the confirmed product scope.** Themes are user-selectable; start
   with `light`, `dark`, and `neon`, with system appearance as the default.
   Support `en`, `fr`, `zh-Hans`, and `ja`; default to the system locale and
   fall back to English, with an in-app language override.
2. **Define token contracts.** Agree on semantic color names, shared visual
   tokens, override rules, responsive breakpoints, and accessibility targets.
3. **Extract the current theme.** Replace `createAppTheme(scheme, width)` with
   a registry/resolver and a separate responsive-layout resolver. Preserve
   the current appearance as the default theme.
4. **Add theme context.** Provide the resolved theme to screens, with system
   appearance as the default and safe fallback for missing preferences.
5. **Add localization.** Install `expo-localization`, `i18next`, and
   `react-i18next`; create repository-managed catalogs for the four selected
   locales and move all visible strings into them.
6. **Add in-app selectors and persistence.** Let users choose the theme and
   language; make `system` the default theme choice and device language the
   default locale. Persist explicit overrides.
7. **Configure platform locales.** Declare the four supported locales in Expo
   localization configuration. Keep RTL-ready layout rules, but do not claim
   RTL localization until an RTL language is selected and tested.
8. **Verify the first release.** Run Jest, type-check, lint, Expo
   configuration checks, and visual QA in the browser and on iOS/Android
   phones. Add further themes and languages only with their complete tokens,
   translations, and tests.

## Confirmed first-release decisions

- Theme selection is available in-app. The initial choices are `system`,
  `light`, `dark`, and `neon`; there are three distinct themes, with a future
  target of about 20.
- Themes may define colors, typography, spacing, shapes, and assets; they are
  not restricted to color changes.
- Initial locales are `en`, `fr`, `zh-Hans`, and `ja`. Follow device/app
  language by default, allow an in-app override, and fall back to English.
- Translation files are reviewed and maintained in the repository.
- QA targets iOS and Android phones plus the browser preview.

## Implementation status

- The registry currently contains `light`, `dark`, and `neon`; responsive
  layout tokens are resolved independently.
- Theme and language choices are selectable in-app and persisted with
  AsyncStorage through compact top-right dropdowns. The language control shows
  the resolved two-letter code; the system/device setting is used by default.
- Translation catalogs exist for `en`, `fr`, `zh-Hans`, and `ja`, and platform
  locale configuration is declared in `app.json`.
- The existing Jest/type/lint and Expo config checks cover the web and shared
  TypeScript behavior. Native device/emulator QA remains outstanding.

## References

- [Theme registry](../src/theme/registry.ts)
- [App configuration](../app.json)
- [Architecture and review guide](./mobile-app-architecture.md)
- [Expo color themes](https://docs.expo.dev/develop/user-interface/color-themes.md)
- [Expo localization guide](https://docs.expo.dev/guides/localization.md)
- [Expo SDK 58 localization API](https://docs.expo.dev/versions/v58.0.0/sdk/localization.md)

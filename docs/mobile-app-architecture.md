# Mobile App Architecture and Review Guide

## Purpose

Use this guide to design and review features in this Expo, React Native,
TypeScript, and Jest app. The goal is to keep functional rules independently
testable, UI focused on interaction and presentation, and mobile/device effects
isolated.

Default to the simplest design that meets the feature's needs. Do not add a
layer, dependency, or global state manager without a concrete use case.

## A simple architecture

```text
Route -> Screen/UI -> feature action -> functional rules
                           |
                           +-> adapter -> network, storage, or device API
```

- **Routes** select and compose screens. Keep route files thin.
- **UI** renders state, handles user interaction, and presents loading, empty,
  and error states. It should not implement business rules or call external
  systems directly.
- **Feature actions** coordinate a user action, update state, and call
  functional rules or adapters. A hook is useful when it simplifies that
  coordination; it is not a required layer.
- **Functional rules** are ordinary TypeScript functions. Keep them free of
  React, React Native, Expo, UI, and I/O dependencies.
- **Adapters** isolate external effects such as HTTP, persistence, permissions,
  sensors, and other device APIs. Add them only when needed.

The functional rules do not depend on UI or adapters. Adapters may use Expo or
native APIs; callers depend on their typed interface rather than their
implementation.

## Practical project structure

Organize by feature as the app grows. A small feature can start with one screen,
one functional module, and a focused test:

```text
App.tsx                       # Root entry that composes the initial screen
src/
  app/                          # Expo Router routes, when navigation is used
  theme/
    registry.ts                 # Complete, named theme definitions
    ThemeProvider.tsx           # Theme selection and resolved tokens
    responsive.ts               # Window-size layout tokens, separate from themes
  localization/
    i18n.ts                     # Translation resources and library setup
    catalogs/                   # Locale- and feature-specific strings
  preferences/
    storage.ts                   # Persisted theme/language choices
  features/
    device-control/
      device-control.ts        # Config types, bounds, and validation
      mock-controls.ts         # Simulated apply action and telemetry
      DeviceControlScreen.tsx  # Dashboard and detail views
      device-control.test.ts   # Config and mock tests
      DeviceControlScreen.test.tsx
  shared/
    ui/
      CompactDropdown.tsx       # Compact, accessible dropdown control
```

Add a feature-local adapter only when that feature needs external I/O. Share
code only after there is a real second use. Avoid empty folders and generic
`utils` or `services` modules that collect unrelated code.

Use Expo Router for navigation, with route files under `src/app/`, in line with
[`AGENTS.md`](../AGENTS.md). This starter app does not currently include Expo
Router; a single-screen app does not need routing just to follow this guide.
When adding Expo or React Native packages, follow the SDK-compatible install
guidance in `AGENTS.md`.

## Design and implementation rules

### Functional rules

- Keep calculations, validation, and decisions in small, typed TypeScript
  functions.
- Prefer pure functions: the same inputs produce the same outputs without
  hidden mutation or side effects.
- Pass variable inputs such as randomness, time, and generated IDs explicitly
  when tests need repeatable results.
- Represent expected failures explicitly. Do not silently hide errors or
  return success-shaped defaults.

### UI and state

- Keep state at the narrowest level that owns it. Use local component state for
  local presentation; add shared state only when multiple parts of the app
  need to coordinate.
- Derive display values instead of storing duplicate state.
- Keep components focused on rendering and user actions. Pass data and
  callbacks through props where that makes ownership clear.
- Keep shared visual tokens such as colors, typography, spacing, and control
  sizes in the theme registry/provider under `src/theme/`; components should
  consume those tokens rather than repeat style values. Use system appearance
  and current window dimensions when theme or layout should adapt, and avoid
  fixed heights that break with small screens or larger accessibility text.
- A theme ID represents a complete visual identity, not just a color palette.
  Keep the theme selection, system-based default, locale, and responsive layout
  as separate concerns. Resolve a stable theme ID to semantic design tokens
  through the theme registry/provider; screens must not branch on theme names
  or hard-code visual values.
- A `system` theme choice may resolve to the light or dark theme from device
  appearance. Keep it as a selection rule, not a fourth theme definition.
- Keep each theme's colors, typography, spacing, shapes, and any required
  assets in its definition. Require a complete token contract, and add themes
  as registry data rather than screen-specific conditionals.
- Derive responsive layout tokens from current window dimensions separately
  from theme selection. Keep content readable on narrow screens, capped on
  wide screens, and scrollable when content or accessibility text grows.
- Put user-visible text in locale catalogs and render it through the
  localization library. Resolve the device/app locale with a documented
  fallback and optional user override, format locale-sensitive values with
  `Intl`, and support logical start/end layout for RTL languages.
- Persist explicit theme and language choices behind a small storage adapter;
  leave the system/device default as the fallback when no choice is saved.
- Keep the app-wide theme and language controls in a compact dropdown row at
  the top-right of the main screen. Show the selected theme name and a
  two-letter language code (`EN`, `FR`, `ZH`, or `JA`); the language menu must
  retain readable locale names and a device-language choice.
- Keep dropdown triggers visually tight (text plus a thin border) without
  shrinking their effective touch target. Use an expanded hit area for the
  trigger, accessible names and expanded/selected states, touch-friendly menu
  options, and close the menu after selection or an outside tap.
- Use accessible roles and labels for controls, and check layouts on narrow
  screens and supported platforms.

### Mobile and external effects

- Keep permissions, app lifecycle subscriptions, sensors, storage, and network
  access at explicit boundaries. Treat permission denial, unavailable devices,
  offline behavior, and app foreground/background transitions as applicable
  feature states, not impossible cases.
- Clean up subscriptions and other ongoing work when their owner unmounts or
  the app no longer needs them.
- Isolate platform-specific behavior; avoid scattering platform checks
  throughout feature logic.
- Do not put secrets in the client app bundle.

### Security hardening proposal: least privilege

Treat the device and all client-side state as potentially inspectable or
modifiable. App-side controls can reduce exposure, but cannot guarantee
protection on a rooted, jailbroken, or otherwise compromised device. Keep
secrets and authorization decisions on trusted services; never rely on code
obfuscation or device-integrity checks as the only security control.

- **Start with zero user-granted device permissions.** This app's baseline
  needs no runtime access to device services: theme, language, and system
  appearance work without camera, microphone, contacts, location,
  photo-library, or notification permissions. A new feature must not add a
  permission, background mode, or sensitive entitlement without a documented
  need and explicit review.
- **Remove scaffold permissions we do not use.** Expo SDK 58's Android base
  manifest adds optional overlay, vibration, and legacy external-storage
  permissions. Block these with `android.blockedPermissions`; retain the
  standard `INTERNET` declaration from Expo's base manifest as a reviewed
  network capability. It is not a user-granted runtime permission.
- **Maintain a capability inventory.** Review `app.json`, Expo config plugins,
  native dependencies, generated iOS/Android permissions and entitlements,
  and third-party data collection when adding or changing a package or device
  integration. For every approved capability, record its feature owner,
  purpose, data accessed, request point, and behavior when access is denied.
  Keep an allowlist and remove capabilities that no current feature needs.
- **Gate configuration changes.** CI should inspect the effective Expo
  configuration and generated native permission/entitlement declarations.
  Fail on additions outside the reviewed allowlist; require the feature
  rationale and review to update that allowlist. Check privacy declarations
  and SDK telemetry as well as OS permission prompts, since data collection
  may not require a runtime permission.
- **Request access only when needed.** Do not request device permissions at
  launch. Ask only after the user starts a feature that needs the capability,
  explain the purpose in context, and request the narrowest available access.
  Prefer scoped pickers and one-time access over broad library, location, or
  background access. A denial or cancellation must leave unrelated features
  usable; do not repeatedly prompt or treat permission as granted.
- **Classify local data.** AsyncStorage is suitable for non-sensitive
  preferences such as the current theme and language. Do not store passwords,
  long-lived credentials, private keys, or sensitive personal data there. If a
  feature genuinely needs a device-held secret, use the platform-backed secure
  storage adapter (for example, `expo-secure-store`), minimize its lifetime,
  and handle unavailable storage explicitly. Keep sensitive data out of logs,
  analytics, clipboard, notifications, and screenshots unless the feature
  specifically requires it and has reviewed safeguards.
- **Keep network and release defaults safe.** Use HTTPS and platform TLS
  validation; never disable certificate checks. Keep API secrets and
  authorization on the server. Store signing credentials in protected build
  infrastructure, not source or app configuration. Run automated dependency
  vulnerability scanning in CI and on a schedule (for npm, run
  `npm audit --audit-level=high`); surface all findings and block new
  critical/high findings unless a documented exception has an owner, rationale,
  and expiry. Review lockfile changes, native code, permissions, and SDK data
  collection. Do not auto-apply breaking security updates or add certificate
  pinning and device-integrity blocking without a concrete threat model and a
  recovery plan.
- **Verify the effective app, not only TypeScript.** For permission or native
  dependency changes, inspect the resulting platform configuration and test
  the relevant iOS and Android builds. Test first launch with no permission
  prompt, grant, denial, cancellation, limited/partial access, “don't ask
  again,” and later revocation where applicable. Recheck the permission
  inventory during review; an unchanged feature should not gain device access
  as a side effect of another change.

## Minimal-footprint hardening implementation plan

Implement these steps in order. The current app only stores non-sensitive
theme/language preferences and does not need user-granted device permissions;
do not add secure storage or permission-handling code without a feature need.

1. **Record the baseline.** Review app code, dependencies, `app.json`, and the
   effective Expo configuration (`npx expo config --type public --json`).
   Generate the native iOS/Android configuration in a clean workspace and
   record current permissions, background modes, entitlements, and SDK data
   collection in a small versioned allowlist. Block Expo's unused Android
   overlay, vibration, and legacy storage permissions. Confirm the baseline
   has no user-granted device permissions and document the retained `INTERNET`
   capability.
2. **Triage the dependency baseline.** Run `npm audit` against the lockfile
   and review native capabilities and data collection for installed packages.
   Resolve applicable high/critical findings or record a temporary exception
   with an owner, rationale, and expiry. Do not use forced broad upgrades as a
   substitute for reviewing the affected packages.
3. **Add a small CI security workflow.** This repository has no existing
   workflow: add a pull-request and scheduled job that installs from the
   lockfile and runs `npm audit --audit-level=high`. Surface lower-severity
   findings, block high/critical findings, and enable Dependabot updates for
   npm packages and GitHub Actions.
4. **Gate permission and capability drift.** Add a focused check that compares
   generated iOS/Android permissions, background
   modes, and entitlements with the allowlist. Fail CI on an unapproved
   addition. Locally run `npm run security:capabilities` after generating
   native projects with `npx expo prebuild --no-install --platform all`.
   Review updates to the allowlist alongside the feature rationale, denial
   behavior, and any SDK telemetry or privacy declaration; do not accept a
   manifest change just because a dependency added it.
5. **Keep the data boundary minimal.** Verify AsyncStorage remains limited to
   theme/language preferences. Do not add credentials, analytics, crash
   reporting, or other data collection without a documented need and review.
   If a future feature needs secrets, select platform-backed secure storage
   then, and separately review token lifetime, logging, backup, and recovery
   behavior.
6. **Verify native behavior before release.** Run the app on iOS and Android
   builds and confirm a clean launch produces no device-permission prompt.
   For any later permission-using feature, test grant, denial, cancellation,
   limited access, “don't ask again,” and revocation where supported. Keep
   current Jest, type-check, config, and dependency checks green.

**Completion criteria:** generated capabilities match the approved baseline
(only `INTERNET` is an active Android permission, with no user-granted
permissions, iOS usage descriptions, background modes, or entitlements); CI
reports dependency findings and enforces the high/critical policy; no
unnecessary device access or sensitive local data has been added; and native
smoke tests confirm no permission prompt on first launch.

## Testing strategy

The project uses Jest, `jest-expo`, and React Native Testing Library, as shown
in [`package.json`](../package.json).

- **Functional tests:** Cover normal behavior, boundaries, and expected invalid
  inputs. Inject randomness, time, or IDs to make outcomes deterministic.
- **UI tests:** Render the screen, find controls by accessible role or visible
  label, perform the user action, and assert on visible results.
- **Theme and localization tests:** Verify registry completeness for each
  theme, locale catalog key parity, fallback behavior, responsive breakpoints,
  and readable contrast.
- **Adapter tests:** Use focused fakes for external systems when needed. Test
  error and success paths without mocking the functional rule being tested.
- **End-to-end tests:** Add them for important device or multi-screen flows
  when the value justifies their setup and maintenance.

Test behavior, not component internals, hook calls, or fragile tree snapshots.
Keep a functional rule testable without rendering React Native UI, and keep a
screen testable without a real network or device service.

## Peer review checklist

For each design or implementation review, trace one user action from input to
visible result and check:

1. **Ownership:** Is each rule, state value, and side effect owned by one clear
   layer? Are routes and UI free of business rules?
2. **Dependencies:** Can functional rules be imported and tested without React,
   Expo, or native modules? Are external effects behind a small boundary?
3. **Mobile behavior:** Where relevant, are permissions, lifecycle, offline,
   and platform-specific cases handled? Are subscriptions and work cleaned up?
4. **Failure behavior:** Are expected errors and unavailable states explicit
   and visible rather than swallowed?
5. **Testability:** Can rules be tested deterministically? Do UI tests exercise
   accessible user interactions and assert on visible behavior?
6. **Visual consistency:** Does each theme provide its complete visual token
   set? Do screens consume theme tokens and translated strings? Are responsive
   layout and locale direction handled independently of theme identity? Are the
   global dropdowns compact, accessible, and displaying the resolved language
   code while preserving full locale names in the menu?
7. **Proportionality:** Does each added abstraction or dependency solve a
   current need? Could a simpler implementation work just as well?
8. **Verification:** Do the focused tests, `npm test -- --runInBand`, and
   `npm run typecheck` pass?
9. **Least privilege:** Does every device capability have a current feature
   need, a narrow request point, and a usable denial path? Did dependency or
   Expo plugin changes add unexpected permissions, entitlements, data
   collection, or local data access? Do CI permission-diff and dependency-scan
   results satisfy the reviewed policy?

When reporting a finding, identify the behavior and affected file or design
boundary, explain its impact, and suggest a practical correction. Prioritize
correctness, data loss, security, accessibility, and lifecycle issues over
style preferences. Do not request layers or abstractions without a concrete
benefit.

## References

- [Scalable themes and localization proposal](./enterprise-theme-localization-proposal.md)
- [Expo Router introduction](https://docs.expo.dev/router/introduction.md)
- [Repository development guidance](../AGENTS.md)

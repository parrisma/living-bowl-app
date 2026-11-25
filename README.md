# Living Bowl

Living Bowl is a cross-platform mobile app built with Expo, React Native, and
TypeScript. The current screen is a random-number demo with responsive layouts,
selectable visual themes, and localized text.

## Features

- System, light, dark, and neon themes.
- System language or English, French, Japanese, and Simplified Chinese.
- Theme and language preferences persist on the device.
- Layout adapts to mobile screen widths.

## Run locally

Requirements: Node.js 22, npm, and Expo Go on a physical device for mobile
preview.

```bash
npm ci
npm start -- --host lan
```

Scan the QR code with Expo Go while the development computer and phone are on
the same network. If the device cannot reach the local network, try tunnel
mode:

```bash
npm start -- --host tunnel
```

## VS Code development container

With Docker available, build and start the development container:

```bash
bash docker/build-dev.sh
bash docker/run-dev.sh
```

In VS Code, use **Dev Containers: Attach to Running Container...** and select
`living-bowl-dev`. In its terminal, install the project dependencies and start
Expo:

```bash
npm ci
npm start -- --host lan
```

The project is already scaffolded; do not run `docker/setup-project.sh`, which
is only for bootstrapping an empty project. The container targets Expo Go and
does not include Android or iOS native build toolchains.

## Project checks

```bash
npm test
npm run typecheck
npm run lint
npm audit --audit-level=high
```

The security workflow also checks the generated mobile capabilities. To run
that check locally:

```bash
npx expo prebuild --no-install --platform all
npm run security:capabilities
```

Prebuild creates ignored `android/` and `ios/` directories; no emulator or
native SDK is required for the capability check.

## Project structure

- `src/features/` contains feature screens and functional logic.
- `src/theme/`, `src/localization/`, and `src/preferences/` handle visual
  themes, translations, and persisted choices.
- `security/device-capabilities.json` is the reviewed native capability
  baseline.
- `docs/mobile-app-architecture.md` describes architecture and security
  conventions.
- `docs/dev-container-requirements.md` describes the development container.

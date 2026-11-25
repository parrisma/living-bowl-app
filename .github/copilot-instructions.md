# Copilot instructions

## Project architecture

- Read and follow [`docs/mobile-app-architecture.md`](../docs/mobile-app-architecture.md)
  before changing app architecture or behavior. Also follow the repository
  guidance in [`AGENTS.md`](../AGENTS.md).
- Keep changes small and proportional. Prefer pure, typed feature logic;
  focused UI; narrow state ownership; and explicit adapters for external
  effects. Avoid abstractions or dependencies without a concrete need.
- Treat the architecture guide as the source of truth for themes,
  localization, responsive layout, accessibility, persistence, and mobile
  security. In particular, keep theme tokens in the theme registry, translated
  text in locale catalogs, and responsive layout separate from theme choice.
- Preserve least privilege. Do not add device permissions, native packages,
  background work, telemetry, or sensitive local storage without a documented
  feature need and review. Keep native capability changes aligned with
  `security/device-capabilities.json`.
- Validate behavior with focused Jest tests and the relevant project checks.
  Run `npm run security:capabilities` after Expo prebuild when native
  capabilities may have changed.

## GitHub authentication

- This user has GitHub two-factor authentication enabled. An account password
  will not authenticate HTTPS Git operations; use the user's configured
  credential manager, VS Code authentication, or a Personal Access Token
  (PAT).
- Never ask the user to paste a PAT into chat, and never place one in a command
  argument, remote URL, source file, or log. Do not retry or recommend the
  account password.
- If existing authentication is unavailable, state the PAT requirement once
  and pause for the user to authenticate securely in their terminal. Do not
  claim a push succeeded until the remote ref has been verified.

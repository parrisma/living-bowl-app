# Proposal: Random Number Hello World

## Goal

Turn the Expo starter screen into a small, mobile-friendly hello-world app. A
user taps one button, the app generates a random number, and the result appears
on screen.

This is a UI demonstration only. It does not connect to the water-feature
hardware, a backend, or external services.

## Proposed behavior

- On launch, show a short welcome message, a prompt to generate a number, and a
  button labeled **Generate number**.
- Do not generate a number automatically on launch.
- When tapped, the button calls one app-level function, `getRandomNumber`,
  which returns an integer from 1 through 100 inclusive.
- Display the returned value clearly after each tap. A result may repeat; the
  app does not promise a different number on every press.

## Implementation outline

- Keep `App.tsx` as the app entry, re-exporting the feature screen.
- Put the screen, `getRandomNumber`, and their tests in
  `src/features/random-number/`, keeping the functional rule separate from UI.
- Implement it as a synchronous function that accepts an optional random
  source, defaulting to `Math.random`. The source returns a value in `[0, 1)`;
  the function maps that to an integer from 1 through 100.
- Use React state to hold the most recently generated value. The button's
  press handler calls `getRandomNumber` once and updates that state.
- Use standard React Native text and button-compatible components, with a
  button role, clear accessible label, and a layout that works on narrow
  screens.
- Add no dependencies, navigation, persistence, or network requests.

## Step-by-step implementation plan

1. **Check the starter screen and existing tests.** Confirm the current Expo
   screen and test conventions before changing files.
2. **Add the number-generation function.** Create
   `src/features/random-number/random-number.ts`. Implement
   `getRandomNumber(random = Math.random)` to return an integer from 1 through
   100, independently of the UI.
3. **Test the function.** Add a focused test using controlled random sources to
   `src/features/random-number/random-number.test.ts` and verify that `0`
   returns `1` and a value just below `1` returns `100`.
4. **Add the feature screen and result state.** Create
   `src/features/random-number/RandomNumberScreen.tsx` with state for the latest
   number, initially unset. Keep `App.tsx` as a thin entry point.
5. **Add the button action.** Add the **Generate number** button and connect its
   press handler to one call to `getRandomNumber()`, storing the return value.
6. **Show the result.** Render a clear prompt before the first press and the
   generated integer after a press.
7. **Check accessibility and layout.** Ensure the button has an accessible
   label and the screen remains readable on a narrow device.
8. **Test the interaction.** Verify the result is initially absent, then press
   the button and assert in
   `src/features/random-number/RandomNumberScreen.test.tsx` that a controlled
   result from `getRandomNumber` is displayed.
9. **Run project checks.** Run the focused Jest test, the full Jest suite, and
   the TypeScript check; resolve any failures before considering the work
   complete.

## Acceptance criteria

1. The initial screen has a welcome message and a **Generate number** button;
   no result is generated until the user taps it.
2. Tapping the button displays an integer in the inclusive range 1–100.
3. Tapping again generates and displays a result without restarting the app;
   the result is allowed to repeat.
4. The number-generation function can be tested independently with a
   deterministic random source, and a screen test verifies that tapping the
   button displays the function's returned value.
5. The app continues to pass its Jest tests and TypeScript check.

## Out of scope

- Building or controlling the water-feature hardware.
- Choosing a custom range, seeding randomness, or guaranteeing that each tap
  produces a different value.
- Saving results or sharing them.

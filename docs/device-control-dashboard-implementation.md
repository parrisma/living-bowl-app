# Device Control Dashboard Implementation

## Goal

Replace the current Hello World/random-number screen with a mobile dashboard
for the automated three-pump water feature described in [goal.md](./goal.md).
The dashboard must show simulated current settings, let the user override
outputs and tune every exposed parameter, and provide a drill-down for
controller details.

This phase is a UI and local mock only. It does not connect to hardware, use
Bluetooth, add native modules, or define a device protocol. Every value shown
must be clearly marked as simulated.

## Dashboard behavior

Use one scrollable dashboard with a heading, a visible `SIMULATED` status, an
override count, and the existing compact theme and language controls in the
top-right. Respect device safe areas so the heading and controls do not
overlap the status bar or notches. Reserve the existing top-control area before
scroll content begins so the title never sits behind the theme/language
dropdowns. Keep status meaning in text, not color alone.

Use an independent `AUTO` / `OVERRIDE` control for each pump, mist, and LED.
The three pumps are independent; mist and LED remain automatic and coupled
unless their own override is enabled.

- **AUTO:** Show the latest mock value as a read-only meter with a visible
  number and unit. Do not render a disabled slider that looks broken or cannot
  be understood by assistive technology. Its accessible label/value should
  state the resource, automatic mode, current value, and range.
- **OVERRIDE:** Enable that resource's output slider. Show confirmed current
  value and draft target separately; seed the draft from the latest mock
  telemetry when override is enabled. Give the slider an accessible label,
  range, current value, and useful step size.
- **Tuning parameters:** Keep profile/controller parameter editing in the
  resource's Details view, independently of output override. A user can tune
  automatic behavior without forcing that output into manual override.
- **Apply changes:** Keep draft edits local and show a sticky action with the
  number of changed resources/parameters. Apply the full config once; never
  call the mock for every slider movement. Provide `Discard` for unapplied
  edits. If leaving Details or discarding would lose drafts, explain that
  before clearing them. Keep the action above the bottom safe area and do not
  cover the last form control.
- **Resume AUTO:** Disable only that resource's override, preserve its
  accepted tuning settings and last value, and leave other overrides unchanged.
  Do not reset values to fixture defaults.
- While a mock call is pending, disable duplicate submissions and show a
  pending state. On success, replace the draft with the accepted config and
  returned simulated telemetry. On rejection, keep the last confirmed state
  and show an accessible error.

Show three pump controls (`Pump 1`–`Pump 3`, flow `0–10`), one mist control
(level `0–10`), and one white LED control (brightness displayed as `0–100%`,
with the raw `0–255` value in Details). For pumps, `0` means off; any positive
flow maps to at least the configured active PWM floor. Do not expose a slider
dead zone below the floor. Show pump phase (`ON`/`OFF`) and mist burst state
as separate read-only labels. In AUTO, automatic mist and LED telemetry must
reflect the actual combined pump activity; overriding one channel must not
silently switch the other channels out of AUTO.

Each resource has one `Details` action opening a full-screen modal with
a clear title and close/back action. Return accessibility focus to the
originating Details control on close. Preserve the dashboard scroll position
and drafts when opening or closing Details. Keep the main screen focused on
the five output controls; use labeled numeric inputs or steppers with units
and bounds for duration, ramp, weight, and other tuning values rather than
turning every parameter into a slider.

Details separate **Live** values from **Settings**:

- **Pump:** live phase, current flow, and evolution progress; editable
  min/max flow, ON/OFF duration bounds, ramp timing, and active PWM floor.
- **Mist:** live level, dynamic cap, average pump activity, and burst state;
  editable level, burst period, and ramp/hold/fade parameters.
- **LED:** live brightness, average activity, mist contribution, and target;
  editable brightness, idle brightness, ramp time, and blend weights.
- **Automation:** cycle duration, target blend factor, current progress, and
  profile targets. Tuning values remain independent of output overrides.

Keep derived telemetry read-only. Avoid charts, a separate profile editor,
routing infrastructure, and additional configuration screens in this first
version. Use the existing theme tokens, responsive sizing, translations, and
accessible control labels. Update every locale catalog when adding visible
strings. The dashboard replaces the current screen in `App.tsx`; do not add a
second route or retain Hello World as the initial screen.

## Mock call and state

Keep the mock close to the feature, for example in
`src/features/device-control/mock-controls.ts`. Do not introduce a generic
transport or hardware abstraction for this UI-only phase. The mock request
must carry the full writable control config—not only the main slider value—so
every output and detail parameter edited by the UI is included in one call.

Use these complete parameter groups in `DeviceControlConfig`. Override state
is per resource, not global:

```ts
type PumpId = 1 | 2 | 3;

type DeviceControlConfig = {
  evolutionCycleMs: number;
  evolutionBlendFactor: number;
  pumps: Record<PumpId, {
    overrideEnabled: boolean;
    manualFlow: number;
    minFlow: number;
    maxFlow: number;
    onDurationMinMs: number;
    onDurationMaxMs: number;
    offDurationMinMs: number;
    offDurationMaxMs: number;
    rampMs: number;
    activePwmFloor: number;
  }>;
  mist: {
    overrideEnabled: boolean;
    manualLevel: number;
    rampMs: number;
    holdMs: number;
    fadeMs: number;
    burstPeriodMs: number;
  };
  led: {
    overrideEnabled: boolean;
    manualBrightness: number;
    idleBrightness: number;
    activityWeight: number;
    mistWeight: number;
    rampMs: number;
  };
};

async function mockApplyControls(
  config: DeviceControlConfig,
): Promise<{ acceptedConfig: DeviceControlConfig; telemetry: MockTelemetry }> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { acceptedConfig: config, telemetry: deriveMockTelemetry(config) };
}

const result = await mockApplyControls({
  ...draftConfig,
  pumps: {
    ...draftConfig.pumps,
    1: {
      ...draftConfig.pumps[1],
      overrideEnabled: true,
      manualFlow: 6.2,
    },
  },
});
```

The config covers all editable settings: evolution cycle and target blend
factor; per-pump override state, manual flow, flow bounds, ON/OFF duration
bounds, ramp time, and active PWM floor; mist override state, level,
ramp/hold/fade times, and burst period; LED override state, brightness, idle
level, activity/mist weights, and ramp time. Every field edited in a slider,
numeric input, or stepper must be sent in the full request. Editing a tuning
parameter while `overrideEnabled` is false must not enable an output override.
Validate the full request atomically, including cross-field ordering such as
minimums not exceeding maximums; reject an invalid request rather than
partially applying it.

Return a complete simulated telemetry snapshot as well, including current pump
flows and phases, profile progress and targets, average activity, mist level,
dynamic cap and burst state, current/target LED brightness, and the bounds used
to validate edits. These are read-only observed, derived, or validation values,
not editable command fields. Every writable parameter from the goal belongs in
`DeviceControlConfig`; every displayed live or derived parameter belongs in
the response snapshot. Keep `HARD_BOUNDS` enforcement in the mock validator;
never let a UI draft bypass the bounds. `smoothstep` is fixed controller
behavior, not a user setting. The mock need not reproduce the
microcontroller's 20 ms control loop.

The goal document does not specify exact duration limits, the target blend
factor, LED blend weights, or all `HARD_BOUNDS` values. Keep those values in a
clearly labeled mock fixture and do not present them as verified hardware
limits. Include the bounds in returned mock details, but enforce them from the
trusted fixture rather than allowing a draft to weaken them. Treat electrical
facts such as supply voltage, GPIO pins, and the mist maker's operating
frequency as read-only hardware information, not control commands. Keep the
seeded config and UI state local unless another screen needs to share them.
Do not persist simulated controls in AsyncStorage.

## Suggested implementation order

1. Define the complete feature-local config, telemetry snapshot, mock fixture,
   validation, and async mock call.
2. Replace the Hello World/random-number initial screen in `App.tsx` with the
   simulated dashboard and five output meters.
3. Add per-resource overrides, draft state, a sticky full-config Apply/Discard
   action, pending/error states, and per-resource Resume AUTO behavior.
4. Add full-screen pump, mist, LED, and automation details; keep output
   telemetry read-only and allow tuning edits without forcing an override.
5. Add translated labels to all catalogs and check 320px-wide layouts, large
   text, safe areas, screen-reader announcements, and accessibility focus.

The dashboard uses `@react-native-community/slider` 5.2.1 and
`react-native-safe-area-context` ~5.11.1, installed with `npx expo install` for
Expo SDK 58 and the Expo Go workflow. Do not add native build tools or a
dependency that requires a custom development client for this mock.

## Focused validation

- Unit-test range validation and accepted values for pump, mist, and LED
  outputs and every writable parameter group. Round-trip every config field
  through the mock call and verify that no detail parameter is dropped.
- UI-test that AUTO meters are accessible and read-only; one resource can be
  overridden without changing the others; and tuning edits do not enable an
  override.
- UI-test that Apply calls the mock once with the complete config, preserves
  drafts across Details, and Discard/Resume AUTO handle unsaved changes
  explicitly.
- UI-test pending, successful, and rejected mock-call states, and verify
  details are reachable, accessible, and distinguish editable config from
  read-only telemetry.
- Run `npm test -- --runInBand`, `npm run typecheck`, and `npm run lint`.
- No native build, device permission, hardware, or network access is required.

## Peer review

The initial proposal was incomplete in three ways: its mock call accepted only
one output value, its detail parameters were read-only, and returning to AUTO
reset values to the seed fixture. The revised proposal makes the mock call
carry all editable pump, mist, LED, and evolution settings; returns a full
telemetry snapshot; preserves accepted values; supports independent
per-resource overrides; and explicitly replaces the current
Hello World/random-number screen. It also distinguishes accessible read-only
meters from editable sliders, selects one detail-view pattern, and provides
explicit draft/apply/discard feedback.

Before any real hardware implementation, confirm the missing numeric
`HARD_BOUNDS`, duration limits, target blend-factor semantics, LED
blend-weight semantics, and PWM calibration values against the controller
firmware. The mock must label provisional values as simulated and must not
imply that they are safe hardware limits.

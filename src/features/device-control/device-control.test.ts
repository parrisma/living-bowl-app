import { describe, expect, it } from '@jest/globals';
import {
  cloneDeviceControlConfig,
  countChangedGroups,
  DEFAULT_DEVICE_CONTROL_CONFIG,
  MOCK_BOUNDS,
  validateDeviceControlConfig,
  type DeviceControlConfig,
  type NumericRange,
} from './device-control';
import {
  createInitialMockTelemetry,
  deriveMockTelemetry,
  MockValidationError,
  mockApplyControls,
} from './mock-controls';

type RangeCase = {
  field: string;
  range: NumericRange;
  set: (config: DeviceControlConfig, value: number) => void;
  prepareBoundary?: (config: DeviceControlConfig) => void;
};

const rangeCases: readonly RangeCase[] = [
  { field: 'evolutionCycleMs', range: MOCK_BOUNDS.cycleMs, set: (config, value) => (config.evolutionCycleMs = value) },
  {
    field: 'evolutionBlendFactor',
    range: MOCK_BOUNDS.blendFactor,
    set: (config, value) => (config.evolutionBlendFactor = value),
  },
  ...([1, 2, 3] as const).flatMap((pumpId) => [
    { field: `pumps.${pumpId}.manualFlow`, range: MOCK_BOUNDS.flow, set: (config: DeviceControlConfig, value: number) => (config.pumps[pumpId].manualFlow = value) },
    {
      field: `pumps.${pumpId}.minFlow`,
      range: MOCK_BOUNDS.flow,
      set: (config: DeviceControlConfig, value: number) => (config.pumps[pumpId].minFlow = value),
      prepareBoundary: (config: DeviceControlConfig) => (config.pumps[pumpId].maxFlow = MOCK_BOUNDS.flow.max),
    },
    {
      field: `pumps.${pumpId}.maxFlow`,
      range: MOCK_BOUNDS.flow,
      set: (config: DeviceControlConfig, value: number) => (config.pumps[pumpId].maxFlow = value),
      prepareBoundary: (config: DeviceControlConfig) => (config.pumps[pumpId].minFlow = MOCK_BOUNDS.flow.min),
    },
    {
      field: `pumps.${pumpId}.onDurationMinMs`,
      range: MOCK_BOUNDS.durationMs,
      set: (config: DeviceControlConfig, value: number) => (config.pumps[pumpId].onDurationMinMs = value),
      prepareBoundary: (config: DeviceControlConfig) =>
        (config.pumps[pumpId].onDurationMaxMs = MOCK_BOUNDS.durationMs.max),
    },
    {
      field: `pumps.${pumpId}.onDurationMaxMs`,
      range: MOCK_BOUNDS.durationMs,
      set: (config: DeviceControlConfig, value: number) => (config.pumps[pumpId].onDurationMaxMs = value),
      prepareBoundary: (config: DeviceControlConfig) =>
        (config.pumps[pumpId].onDurationMinMs = MOCK_BOUNDS.durationMs.min),
    },
    {
      field: `pumps.${pumpId}.offDurationMinMs`,
      range: MOCK_BOUNDS.durationMs,
      set: (config: DeviceControlConfig, value: number) => (config.pumps[pumpId].offDurationMinMs = value),
      prepareBoundary: (config: DeviceControlConfig) =>
        (config.pumps[pumpId].offDurationMaxMs = MOCK_BOUNDS.durationMs.max),
    },
    {
      field: `pumps.${pumpId}.offDurationMaxMs`,
      range: MOCK_BOUNDS.durationMs,
      set: (config: DeviceControlConfig, value: number) => (config.pumps[pumpId].offDurationMaxMs = value),
      prepareBoundary: (config: DeviceControlConfig) =>
        (config.pumps[pumpId].offDurationMinMs = MOCK_BOUNDS.durationMs.min),
    },
    { field: `pumps.${pumpId}.rampMs`, range: MOCK_BOUNDS.rampMs, set: (config: DeviceControlConfig, value: number) => (config.pumps[pumpId].rampMs = value) },
    { field: `pumps.${pumpId}.activePwmFloor`, range: MOCK_BOUNDS.pwm, set: (config: DeviceControlConfig, value: number) => (config.pumps[pumpId].activePwmFloor = value) },
  ]),
  { field: 'mist.manualLevel', range: MOCK_BOUNDS.mistLevel, set: (config, value) => (config.mist.manualLevel = value) },
  { field: 'mist.rampMs', range: MOCK_BOUNDS.rampMs, set: (config, value) => (config.mist.rampMs = value) },
  { field: 'mist.holdMs', range: MOCK_BOUNDS.durationMs, set: (config, value) => (config.mist.holdMs = value) },
  { field: 'mist.fadeMs', range: MOCK_BOUNDS.durationMs, set: (config, value) => (config.mist.fadeMs = value) },
  { field: 'mist.burstPeriodMs', range: MOCK_BOUNDS.burstPeriodMs, set: (config, value) => (config.mist.burstPeriodMs = value) },
  { field: 'led.manualBrightness', range: MOCK_BOUNDS.brightness, set: (config, value) => (config.led.manualBrightness = value) },
  { field: 'led.idleBrightness', range: MOCK_BOUNDS.brightness, set: (config, value) => (config.led.idleBrightness = value) },
  { field: 'led.activityWeight', range: MOCK_BOUNDS.weight, set: (config, value) => (config.led.activityWeight = value) },
  { field: 'led.mistWeight', range: MOCK_BOUNDS.weight, set: (config, value) => (config.led.mistWeight = value) },
  { field: 'led.rampMs', range: MOCK_BOUNDS.rampMs, set: (config, value) => (config.led.rampMs = value) },
];

describe('device control config', () => {
  it('accepts the complete simulated fixture', () => {
    expect(validateDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG)).toEqual([]);
  });

  it('rejects out-of-range values and invalid min/max ordering', () => {
    const config = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    config.pumps[1].minFlow = 8;
    config.pumps[1].maxFlow = 7;
    config.mist.burstPeriodMs = MOCK_BOUNDS.burstPeriodMs.max + 1;
    config.led.overrideEnabled = false;

    expect(validateDeviceControlConfig(config)).toEqual(
      expect.arrayContaining([
        'pumps.1.minFlow must not exceed pumps.1.maxFlow',
        'mist.burstPeriodMs',
      ]),
    );
  });

  it.each(rangeCases)('validates both bounds for $field', ({ field, range, set, prepareBoundary }) => {
    const below = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    set(below, range.min - 1);
    expect(validateDeviceControlConfig(below)).toContain(field);

    const above = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    set(above, range.max + 1);
    expect(validateDeviceControlConfig(above)).toContain(field);

    const atMin = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    prepareBoundary?.(atMin);
    set(atMin, range.min);
    expect(validateDeviceControlConfig(atMin)).toEqual([]);

    const atMax = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    prepareBoundary?.(atMax);
    set(atMax, range.max);
    expect(validateDeviceControlConfig(atMax)).toEqual([]);
  });

  it('rejects non-finite numeric values and non-boolean override flags', () => {
    const config = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    config.evolutionBlendFactor = Number.NaN;
    config.led.activityWeight = Number.POSITIVE_INFINITY;
    Reflect.set(config.pumps[2], 'overrideEnabled', 1);
    Reflect.set(config.mist, 'overrideEnabled', null);

    expect(validateDeviceControlConfig(config)).toEqual(
      expect.arrayContaining([
        'evolutionBlendFactor',
        'led.activityWeight',
        'pumps.2.overrideEnabled',
        'mist.overrideEnabled',
      ]),
    );
  });

  it('rejects an invalid full request instead of returning partial success', async () => {
    const config = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    config.mist.manualLevel = MOCK_BOUNDS.mistLevel.max + 1;

    await expect(mockApplyControls(config, createInitialMockTelemetry())).rejects.toBeInstanceOf(MockValidationError);
  });

  it('round-trips every writable parameter through one mock apply', async () => {
    const config = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    config.evolutionCycleMs = 900_000;
    config.evolutionBlendFactor = 0.6;
    config.pumps[1] = {
      overrideEnabled: true,
      manualFlow: 6.2,
      minFlow: 1.2,
      maxFlow: 8.3,
      onDurationMinMs: 7_000,
      onDurationMaxMs: 25_000,
      offDurationMinMs: 10_000,
      offDurationMaxMs: 32_000,
      rampMs: 2_300,
      activePwmFloor: 48,
    };
    config.pumps[2].manualFlow = 1.1;
    config.pumps[3].activePwmFloor = 40;
    config.mist = {
      overrideEnabled: true,
      manualLevel: 4.8,
      rampMs: 2_000,
      holdMs: 3_000,
      fadeMs: 4_000,
      burstPeriodMs: 2_800,
    };
    config.led = {
      overrideEnabled: true,
      manualBrightness: 200,
      idleBrightness: 30,
      activityWeight: 0.4,
      mistWeight: 0.6,
      rampMs: 1_100,
    };

    const result = await mockApplyControls(config, createInitialMockTelemetry());

    expect(result.acceptedConfig).toEqual(config);
    expect(result.telemetry.bounds).toEqual(MOCK_BOUNDS);
    expect(result.telemetry.pumps[1]).toMatchObject({
      currentFlow: 6.2,
      currentPwm: expect.any(Number),
      phase: 'on',
    });
    expect(result.telemetry.mist.level).toBe(4.8);
    expect(result.telemetry.led.currentBrightness).toBe(200);
    config.led.manualBrightness = 1;
    expect(result.acceptedConfig.led.manualBrightness).toBe(200);
  });

  it('maps every positive pump flow to at least its PWM floor and keeps zero off', async () => {
    const config = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    config.pumps[1].overrideEnabled = true;
    config.pumps[1].manualFlow = 0.1;
    config.pumps[1].activePwmFloor = 200;
    const active = await mockApplyControls(config, createInitialMockTelemetry());

    expect(active.telemetry.pumps[1].currentPwm).toBe(200);

    config.pumps[1].manualFlow = 0;
    const off = await mockApplyControls(config, active.telemetry);
    expect(off.telemetry.pumps[1]).toMatchObject({ currentPwm: 0, phase: 'off' });
  });

  it('preserves the latest pump value when its override resumes automatic mode', async () => {
    const config = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    config.pumps[1].overrideEnabled = true;
    config.pumps[1].manualFlow = 6.2;
    const overridden = await mockApplyControls(config, createInitialMockTelemetry());
    overridden.acceptedConfig.pumps[1].overrideEnabled = false;

    const resumed = await mockApplyControls(overridden.acceptedConfig, overridden.telemetry);
    expect(resumed.telemetry.pumps[1].currentFlow).toBe(6.2);
    expect(resumed.acceptedConfig.pumps[1].manualFlow).toBe(6.2);
  });

  it('couples automatic mist and LED telemetry to combined pump activity', () => {
    const initial = createInitialMockTelemetry();
    const config = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    config.pumps[1].overrideEnabled = true;
    config.pumps[1].manualFlow = MOCK_BOUNDS.flow.max;
    config.mist.overrideEnabled = true;
    config.mist.manualLevel = 2;

    const updated = deriveMockTelemetry(config, initial);

    expect(updated.pumps[1].currentFlow).toBe(10);
    expect(updated.averagePumpActivity).toBeGreaterThan(initial.averagePumpActivity);
    expect(updated.mist.level).toBe(2);
    expect(updated.led.targetBrightness).toBeGreaterThan(initial.led.targetBrightness);
    expect(config.pumps[2].overrideEnabled).toBe(false);
    expect(config.pumps[3].overrideEnabled).toBe(false);
    expect(config.led.overrideEnabled).toBe(false);
  });

  it('counts changed resources rather than individual parameter edits', () => {
    const accepted = cloneDeviceControlConfig(DEFAULT_DEVICE_CONTROL_CONFIG);
    const draft = cloneDeviceControlConfig(accepted);
    expect(countChangedGroups(draft, accepted)).toBe(0);

    draft.pumps[1].minFlow += 0.1;
    draft.pumps[1].rampMs += 100;
    draft.mist.manualLevel += 0.1;
    draft.led.activityWeight -= 0.05;
    draft.evolutionCycleMs += 60_000;

    expect(countChangedGroups(draft, accepted)).toBe(4);
  });
});

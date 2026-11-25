export const PUMP_IDS = [1, 2, 3] as const;

export type PumpId = (typeof PUMP_IDS)[number];
export type NumericRange = { min: number; max: number };

export const MOCK_BOUNDS = {
  flow: { min: 0, max: 10 },
  durationMs: { min: 1_000, max: 600_000 },
  rampMs: { min: 0, max: 60_000 },
  pwm: { min: 0, max: 255 },
  mistLevel: { min: 0, max: 10 },
  burstPeriodMs: { min: 100, max: 60_000 },
  brightness: { min: 0, max: 255 },
  weight: { min: 0, max: 1 },
  cycleMs: { min: 10_000, max: 86_400_000 },
  blendFactor: { min: 0, max: 1 },
} satisfies Record<string, NumericRange>;

export type PumpControlConfig = {
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
};

export type DeviceControlConfig = {
  evolutionCycleMs: number;
  evolutionBlendFactor: number;
  pumps: Record<PumpId, PumpControlConfig>;
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

export const DEFAULT_DEVICE_CONTROL_CONFIG: DeviceControlConfig = {
  evolutionCycleMs: 600_000,
  evolutionBlendFactor: 0.35,
  pumps: {
    1: {
      overrideEnabled: false,
      manualFlow: 4.2,
      minFlow: 2,
      maxFlow: 7.5,
      onDurationMinMs: 5_000,
      onDurationMaxMs: 20_000,
      offDurationMinMs: 8_000,
      offDurationMaxMs: 30_000,
      rampMs: 1_500,
      activePwmFloor: 32,
    },
    2: {
      overrideEnabled: false,
      manualFlow: 0,
      minFlow: 1,
      maxFlow: 6.5,
      onDurationMinMs: 6_000,
      onDurationMaxMs: 18_000,
      offDurationMinMs: 9_000,
      offDurationMaxMs: 28_000,
      rampMs: 1_200,
      activePwmFloor: 28,
    },
    3: {
      overrideEnabled: false,
      manualFlow: 6.1,
      minFlow: 2.5,
      maxFlow: 8,
      onDurationMinMs: 4_000,
      onDurationMaxMs: 16_000,
      offDurationMinMs: 7_000,
      offDurationMaxMs: 24_000,
      rampMs: 1_800,
      activePwmFloor: 36,
    },
  },
  mist: {
    overrideEnabled: false,
    manualLevel: 3.4,
    rampMs: 1_000,
    holdMs: 1_000,
    fadeMs: 1_500,
    burstPeriodMs: 2_500,
  },
  led: {
    overrideEnabled: false,
    manualBrightness: 160,
    idleBrightness: 24,
    activityWeight: 0.7,
    mistWeight: 0.3,
    rampMs: 800,
  },
};

export function cloneDeviceControlConfig(config: DeviceControlConfig): DeviceControlConfig {
  return {
    ...config,
    pumps: {
      1: { ...config.pumps[1] },
      2: { ...config.pumps[2] },
      3: { ...config.pumps[3] },
    },
    mist: { ...config.mist },
    led: { ...config.led },
  };
}

export function validateDeviceControlConfig(config: DeviceControlConfig): string[] {
  const issues: string[] = [];
  const checkRange = (name: string, value: number, range: NumericRange) => {
    if (!Number.isFinite(value) || value < range.min || value > range.max) {
      issues.push(name);
    }
  };
  const checkOrdered = (minName: string, min: number, maxName: string, max: number) => {
    if (min > max) {
      issues.push(`${minName} must not exceed ${maxName}`);
    }
  };

  checkRange('evolutionCycleMs', config.evolutionCycleMs, MOCK_BOUNDS.cycleMs);
  checkRange('evolutionBlendFactor', config.evolutionBlendFactor, MOCK_BOUNDS.blendFactor);

  for (const pumpId of PUMP_IDS) {
    const pump = config.pumps[pumpId];
    if (typeof pump.overrideEnabled !== 'boolean') {
      issues.push(`pumps.${pumpId}.overrideEnabled`);
    }
    checkRange(`pumps.${pumpId}.manualFlow`, pump.manualFlow, MOCK_BOUNDS.flow);
    checkRange(`pumps.${pumpId}.minFlow`, pump.minFlow, MOCK_BOUNDS.flow);
    checkRange(`pumps.${pumpId}.maxFlow`, pump.maxFlow, MOCK_BOUNDS.flow);
    checkOrdered(`pumps.${pumpId}.minFlow`, pump.minFlow, `pumps.${pumpId}.maxFlow`, pump.maxFlow);
    checkRange(`pumps.${pumpId}.onDurationMinMs`, pump.onDurationMinMs, MOCK_BOUNDS.durationMs);
    checkRange(`pumps.${pumpId}.onDurationMaxMs`, pump.onDurationMaxMs, MOCK_BOUNDS.durationMs);
    checkOrdered(
      `pumps.${pumpId}.onDurationMinMs`,
      pump.onDurationMinMs,
      `pumps.${pumpId}.onDurationMaxMs`,
      pump.onDurationMaxMs,
    );
    checkRange(`pumps.${pumpId}.offDurationMinMs`, pump.offDurationMinMs, MOCK_BOUNDS.durationMs);
    checkRange(`pumps.${pumpId}.offDurationMaxMs`, pump.offDurationMaxMs, MOCK_BOUNDS.durationMs);
    checkOrdered(
      `pumps.${pumpId}.offDurationMinMs`,
      pump.offDurationMinMs,
      `pumps.${pumpId}.offDurationMaxMs`,
      pump.offDurationMaxMs,
    );
    checkRange(`pumps.${pumpId}.rampMs`, pump.rampMs, MOCK_BOUNDS.rampMs);
    checkRange(`pumps.${pumpId}.activePwmFloor`, pump.activePwmFloor, MOCK_BOUNDS.pwm);
  }

  if (typeof config.mist.overrideEnabled !== 'boolean') {
    issues.push('mist.overrideEnabled');
  }
  checkRange('mist.manualLevel', config.mist.manualLevel, MOCK_BOUNDS.mistLevel);
  checkRange('mist.rampMs', config.mist.rampMs, MOCK_BOUNDS.rampMs);
  checkRange('mist.holdMs', config.mist.holdMs, MOCK_BOUNDS.durationMs);
  checkRange('mist.fadeMs', config.mist.fadeMs, MOCK_BOUNDS.durationMs);
  checkRange('mist.burstPeriodMs', config.mist.burstPeriodMs, MOCK_BOUNDS.burstPeriodMs);

  if (typeof config.led.overrideEnabled !== 'boolean') {
    issues.push('led.overrideEnabled');
  }
  checkRange('led.manualBrightness', config.led.manualBrightness, MOCK_BOUNDS.brightness);
  checkRange('led.idleBrightness', config.led.idleBrightness, MOCK_BOUNDS.brightness);
  checkRange('led.activityWeight', config.led.activityWeight, MOCK_BOUNDS.weight);
  checkRange('led.mistWeight', config.led.mistWeight, MOCK_BOUNDS.weight);
  checkRange('led.rampMs', config.led.rampMs, MOCK_BOUNDS.rampMs);

  return issues;
}

export function countChangedGroups(current: DeviceControlConfig, accepted: DeviceControlConfig): number {
  let count = 0;
  const differs = (left: unknown, right: unknown) => JSON.stringify(left) !== JSON.stringify(right);

  for (const pumpId of PUMP_IDS) {
    if (differs(current.pumps[pumpId], accepted.pumps[pumpId])) {
      count += 1;
    }
  }
  if (differs(current.mist, accepted.mist)) {
    count += 1;
  }
  if (differs(current.led, accepted.led)) {
    count += 1;
  }
  if (
    current.evolutionCycleMs !== accepted.evolutionCycleMs ||
    current.evolutionBlendFactor !== accepted.evolutionBlendFactor
  ) {
    count += 1;
  }

  return count;
}

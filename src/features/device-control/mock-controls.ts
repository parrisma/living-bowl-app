import {
  cloneDeviceControlConfig,
  DEFAULT_DEVICE_CONTROL_CONFIG,
  MOCK_BOUNDS,
  PUMP_IDS,
  validateDeviceControlConfig,
  type DeviceControlConfig,
  type PumpId,
} from './device-control';

const INITIAL_PUMP_FLOWS: Record<PumpId, number> = { 1: 4.2, 2: 0, 3: 6.1 };
const INITIAL_EVOLUTION_PROGRESS = 0.37;

export type MockTelemetry = {
  uptimeMs: number;
  lastLoopDtMs: number;
  evolution: {
    progress: number;
    elapsedMs: number;
    cycleMs: number;
    targetBlendFactor: number;
  };
  pumps: Record<
    PumpId,
    {
      currentFlow: number;
      currentPwm: number;
      phase: 'on' | 'off';
      profileTargetFlow: number;
      onDurationTargetMs: number;
      offDurationTargetMs: number;
    }
  >;
  averagePumpActivity: number;
  mist: {
    level: number;
    dynamicCap: number;
    burstOn: boolean;
  };
  led: {
    currentBrightness: number;
    targetBrightness: number;
    activityContribution: number;
    mistContribution: number;
  };
  bounds: typeof MOCK_BOUNDS;
};

export class MockValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super('The simulated settings are outside their mock bounds.');
    this.name = 'MockValidationError';
    this.issues = issues;
  }
}

export function createInitialMockTelemetry(): MockTelemetry {
  return deriveMockTelemetry(DEFAULT_DEVICE_CONTROL_CONFIG);
}

export function deriveMockTelemetry(
  config: DeviceControlConfig,
  previous?: MockTelemetry,
): MockTelemetry {
  const progress = previous?.evolution.progress ?? INITIAL_EVOLUTION_PROGRESS;
  const elapsedMs = Math.round(config.evolutionCycleMs * progress);
  const createPumpTelemetry = (pumpId: PumpId): MockTelemetry['pumps'][PumpId] => {
      const settings = config.pumps[pumpId];
      const currentFlow = round(
        settings.overrideEnabled
          ? settings.manualFlow
          : (previous?.pumps[pumpId].currentFlow ?? INITIAL_PUMP_FLOWS[pumpId]),
        1,
      );
      const blend = progress * config.evolutionBlendFactor;
      const target = settings.minFlow + (settings.maxFlow - settings.minFlow) * blend;
      const onDurationTargetMs =
        settings.onDurationMinMs + (settings.onDurationMaxMs - settings.onDurationMinMs) * blend;
      const offDurationTargetMs =
        settings.offDurationMinMs + (settings.offDurationMaxMs - settings.offDurationMinMs) * blend;

      return {
        currentFlow,
        currentPwm:
          currentFlow <= 0
            ? 0
            : Math.min(
                MOCK_BOUNDS.pwm.max,
                Math.max(settings.activePwmFloor, Math.round((currentFlow / MOCK_BOUNDS.flow.max) * MOCK_BOUNDS.pwm.max)),
              ),
        phase: currentFlow > 0 ? 'on' : 'off',
        profileTargetFlow: round(target, 1),
        onDurationTargetMs: Math.round(onDurationTargetMs),
        offDurationTargetMs: Math.round(offDurationTargetMs),
      };
    };
  const pumps: MockTelemetry['pumps'] = {
    1: createPumpTelemetry(1),
    2: createPumpTelemetry(2),
    3: createPumpTelemetry(3),
  };
  const averagePumpActivity =
    PUMP_IDS.reduce((sum, pumpId) => sum + pumps[pumpId].currentFlow / MOCK_BOUNDS.flow.max, 0) /
    PUMP_IDS.length;
  const dynamicCap = round(Math.min(MOCK_BOUNDS.mistLevel.max, 2 + averagePumpActivity * 8), 1);
  const level = round(
    config.mist.overrideEnabled
      ? config.mist.manualLevel
      : Math.min(dynamicCap, averagePumpActivity * MOCK_BOUNDS.mistLevel.max),
    1,
  );
  const burstOn =
    level > 0 && Math.floor(elapsedMs / Math.max(config.mist.burstPeriodMs, 1)) % 2 === 0;
  const totalLedWeight = config.led.activityWeight + config.led.mistWeight;
  const activityContribution =
    totalLedWeight === 0 ? 0 : (averagePumpActivity * config.led.activityWeight) / totalLedWeight;
  const mistContribution =
    totalLedWeight === 0 ? 0 : ((level / MOCK_BOUNDS.mistLevel.max) * config.led.mistWeight) / totalLedWeight;
  const targetBrightness = Math.round(
    config.led.idleBrightness +
      (MOCK_BOUNDS.brightness.max - config.led.idleBrightness) *
        (activityContribution + mistContribution),
  );
  const currentBrightness = config.led.overrideEnabled ? config.led.manualBrightness : targetBrightness;

  return {
    uptimeMs: (previous?.uptimeMs ?? 123_456) + (previous ? 150 : 0),
    lastLoopDtMs: 20,
    evolution: {
      progress,
      elapsedMs,
      cycleMs: config.evolutionCycleMs,
      targetBlendFactor: config.evolutionBlendFactor,
    },
    pumps,
    averagePumpActivity: round(averagePumpActivity, 3),
    mist: { level, dynamicCap, burstOn },
    led: {
      currentBrightness,
      targetBrightness,
      activityContribution: round(activityContribution, 3),
      mistContribution: round(mistContribution, 3),
    },
    bounds: MOCK_BOUNDS,
  };
}

export async function mockApplyControls(
  config: DeviceControlConfig,
  previousTelemetry: MockTelemetry,
): Promise<{ acceptedConfig: DeviceControlConfig; telemetry: MockTelemetry }> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const issues = validateDeviceControlConfig(config);
  if (issues.length > 0) {
    throw new MockValidationError(issues);
  }

  const acceptedConfig = cloneDeviceControlConfig(config);
  return {
    acceptedConfig,
    telemetry: deriveMockTelemetry(acceptedConfig, previousTelemetry),
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

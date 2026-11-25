import { afterEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import App from '../../../App';
import * as mockControls from './mock-controls';
import { MockValidationError } from './mock-controls';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      multiGet: async (keys: string[]) => keys.map((key) => [key, values.get(key) ?? null]),
      setItem: async (key: string, value: string) => {
        values.set(key, value);
      },
      clear: async () => {
        values.clear();
      },
    },
  };
});

jest.mock('expo-localization', () => ({
  useLocales: () => [{ languageTag: 'en-US' }],
}));

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual<{ default: typeof import('react-native-safe-area-context') }>(
    'react-native-safe-area-context/jest/mock',
  ).default,
);

jest.mock('@react-native-community/slider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { TextInput } = jest.requireActual<typeof import('react-native')>('react-native');

  type MockSliderProps = {
    accessibilityLabel?: string;
    accessibilityValue?: { min?: number; max?: number; now?: number; text?: string };
    disabled?: boolean;
    testID?: string;
    value: number;
    onValueChange?: (value: number) => void;
  };

  function MockSlider({ accessibilityLabel, accessibilityValue, disabled, testID, value, onValueChange }: MockSliderProps) {
    return React.createElement(TextInput, {
      accessibilityLabel,
      accessibilityRole: 'adjustable',
      accessibilityValue,
      editable: !disabled,
      keyboardType: 'decimal-pad',
      onChangeText: (text) => {
        const nextValue = Number(text);
        if (Number.isFinite(nextValue)) {
          onValueChange?.(nextValue);
        }
      },
      testID,
      value: String(value),
    });
  }

  return { __esModule: true, default: MockSlider };
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DeviceControlScreen', () => {
  it('shows accessible automatic meters and preserves theme and language controls', async () => {
    await AsyncStorage.clear();
    const { getByRole, findByText } = await render(<App />);

    expect(await findByText('SIMULATED')).toBeTruthy();
    expect(getByRole('progressbar', { name: 'Pump 1 automatic mode, read-only value' })).toBeTruthy();
    expect(getByRole('progressbar', { name: 'Mist automatic mode, read-only value' })).toBeTruthy();
    expect(getByRole('progressbar', { name: 'White LED automatic mode, read-only value' })).toBeTruthy();
    await waitFor(() => {
      expect(getByRole('button', { name: 'Theme: System' }).props.accessibilityState?.disabled).toBe(false);
    });

    await fireEvent.press(getByRole('button', { name: 'Theme: System' }));
    expect(getByRole('radio', { name: 'Neon' })).toBeTruthy();
    await fireEvent.press(getByRole('radio', { name: 'Neon' }));
    await waitFor(() => expect(getByRole('button', { name: 'Theme: Neon' })).toBeTruthy());
    await fireEvent.press(getByRole('button', { name: 'Language: Device (EN)' }));
    expect(getByRole('radio', { name: 'Français (FR)' })).toBeTruthy();
    await fireEvent.press(getByRole('radio', { name: 'Français (FR)' }));
    expect(await findByText('Commandes de l’appareil')).toBeTruthy();
    expect(getByRole('button', { name: 'Thème: Néon' })).toBeTruthy();
  });

  it('enables one output slider without changing other resources from AUTO', async () => {
    await AsyncStorage.clear();
    const { getByRole, getByTestId, findByText } = await render(<App />);
    await findByText('SIMULATED');

    await fireEvent.press(getByRole('radio', { name: 'Pump 1: OVERRIDE' }));

    expect(getByTestId('pump-1-slider')).toBeTruthy();
    expect(getByRole('radio', { name: 'Pump 1: OVERRIDE' }).props.accessibilityState?.checked).toBe(true);
    expect(getByRole('radio', { name: 'Mist: AUTO' }).props.accessibilityState?.checked).toBe(true);
    expect(getByRole('radio', { name: 'White LED: AUTO' }).props.accessibilityState?.checked).toBe(true);
    expect(getByRole('button', { name: 'Pump 1 details' })).toBeTruthy();
  });

  it('applies slider drafts for every output and preserves them when the selected mode is tapped again', async () => {
    await AsyncStorage.clear();
    const applySpy = jest.spyOn(mockControls, 'mockApplyControls');
    const { getByRole, getByTestId, getAllByText, findByText } = await render(<App />);
    await findByText('SIMULATED');

    await fireEvent.press(getByRole('radio', { name: 'Pump 1: OVERRIDE' }));
    await fireEvent.changeText(getByTestId('pump-1-slider'), '5.5');
    await fireEvent.press(getByRole('radio', { name: 'Pump 1: OVERRIDE' }));
    expect(getAllByText('5.5 L/min')).toHaveLength(1);

    await fireEvent.press(getByRole('radio', { name: 'Mist: OVERRIDE' }));
    await fireEvent.changeText(getByTestId('mist-slider'), '6.7');
    await fireEvent.press(getByRole('radio', { name: 'Mist: OVERRIDE' }));
    await fireEvent.press(getByRole('radio', { name: 'White LED: OVERRIDE' }));
    await fireEvent.changeText(getByTestId('led-slider'), '85');
    await fireEvent.press(getByRole('radio', { name: 'White LED: OVERRIDE' }));

    expect(getByRole('adjustable', { name: 'Mist override target 6.7 / 10, range 0 to 10 level' })).toBeTruthy();
    expect(getByRole('adjustable', { name: 'White LED override target 85%, range 0 to 100 %' })).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Apply changes' }));
    await waitFor(() => expect(applySpy).toHaveBeenCalledTimes(1));
    expect(applySpy.mock.calls[0][0].pumps[1].manualFlow).toBe(5.5);
    expect(applySpy.mock.calls[0][0].mist.manualLevel).toBe(6.7);
    expect(applySpy.mock.calls[0][0].led.manualBrightness).toBe(217);
  });

  it('keeps every detail edit separate from output overrides and applies the complete config once', async () => {
    await AsyncStorage.clear();
    const applySpy = jest.spyOn(mockControls, 'mockApplyControls');
    const { getByRole, findByText } = await render(<App />);
    await findByText('SIMULATED');

    await fireEvent.press(getByRole('button', { name: 'Pump 1 details' }));
    expect(await findByText('Pump 1 details')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Increase Minimum flow' }));
    await fireEvent.press(getByRole('button', { name: 'Close details' }));

    expect(getByRole('radio', { name: 'Pump 1: AUTO' }).props.accessibilityState?.checked).toBe(true);

    await fireEvent.press(getByRole('button', { name: 'Mist details' }));
    expect(await findByText('Mist details')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Increase Manual level' }));
    await fireEvent.press(getByRole('button', { name: 'Close details' }));
    expect(getByRole('radio', { name: 'Mist: AUTO' }).props.accessibilityState?.checked).toBe(true);

    await fireEvent.press(getByRole('button', { name: 'White LED details' }));
    expect(await findByText('White LED details')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Increase Manual brightness' }));
    await fireEvent.press(getByRole('button', { name: 'Close details' }));
    expect(getByRole('radio', { name: 'White LED: AUTO' }).props.accessibilityState?.checked).toBe(true);

    await fireEvent.press(getByRole('button', { name: 'Automation details' }));
    expect(await findByText('Automation details')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Increase Cycle duration' }));
    await fireEvent.press(getByRole('button', { name: 'Increase Target blend factor' }));
    await fireEvent.press(getByRole('button', { name: 'Close details' }));

    await fireEvent.press(getByRole('button', { name: 'Apply changes' }));
    await waitFor(() => expect(applySpy).toHaveBeenCalledTimes(1));
    expect(applySpy.mock.calls[0][0].pumps[1]).toMatchObject({
      overrideEnabled: false,
      manualFlow: 4.2,
      minFlow: 2.1,
      maxFlow: 7.5,
      activePwmFloor: 32,
    });
    expect(applySpy.mock.calls[0][0]).toMatchObject({
      evolutionCycleMs: 660_000,
      evolutionBlendFactor: 0.4,
      mist: {
        overrideEnabled: false,
        manualLevel: 3.5,
        rampMs: 1_000,
        holdMs: 1_000,
        fadeMs: 1_500,
        burstPeriodMs: 2_500,
      },
      led: {
        overrideEnabled: false,
        manualBrightness: 161,
        idleBrightness: 24,
        activityWeight: 0.7,
        mistWeight: 0.3,
        rampMs: 800,
      },
    });
    expect(applySpy.mock.calls[0][0].evolutionCycleMs).toBe(660_000);
    await waitFor(() => {
      expect(getByRole('button', { name: 'Apply changes' }).props.accessibilityState?.disabled).toBe(true);
    });
  });

  it('confirms before discarding drafts and reports the pending apply state', async () => {
    await AsyncStorage.clear();
    const { getByRole, findByText } = await render(<App />);
    await findByText('SIMULATED');

    await fireEvent.press(getByRole('radio', { name: 'Pump 1: OVERRIDE' }));
    await fireEvent.press(getByRole('button', { name: 'Discard changes' }));
    expect(await findByText('Discard all unsaved changes?')).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Keep editing' }));
    await fireEvent.press(getByRole('button', { name: 'Discard changes' }));
    await fireEvent.press(getByRole('button', { name: 'Discard' }));

    expect(getByRole('radio', { name: 'Pump 1: AUTO' }).props.accessibilityState?.checked).toBe(true);
    expect(getByRole('button', { name: 'Apply changes' }).props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(getByRole('radio', { name: 'Pump 1: OVERRIDE' }));
    let finishApply: (() => void) | undefined;
    const applySpy = jest.spyOn(mockControls, 'mockApplyControls').mockImplementation((config, telemetry) =>
      new Promise((resolve) => {
        finishApply = () => resolve({ acceptedConfig: config, telemetry });
      }),
    );
    await fireEvent.press(getByRole('button', { name: 'Apply changes' }));
    expect(getByRole('button', { name: 'Applying…' })).toBeTruthy();
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(getByRole('button', { name: 'Applying…' }).props.accessibilityState?.disabled).toBe(true);
    finishApply?.();
    await waitFor(() => expect(getByRole('button', { name: 'Apply changes' }).props.accessibilityState?.disabled).toBe(true));
  });

  it('shows an accessible error and keeps the confirmed telemetry when apply is rejected', async () => {
    await AsyncStorage.clear();
    jest
      .spyOn(mockControls, 'mockApplyControls')
      .mockRejectedValueOnce(new MockValidationError(['mist.manualLevel']));
    const { getByRole, getAllByText, findByText } = await render(<App />);
    await findByText('SIMULATED');

    await fireEvent.press(getByRole('radio', { name: 'Mist: OVERRIDE' }));
    await fireEvent.press(getByRole('button', { name: 'Apply changes' }));

    expect(await findByText('One or more values are outside the mock limits.')).toBeTruthy();
    expect(getAllByText('3.4 / 10')).toHaveLength(2);
    expect(getByRole('radio', { name: 'Mist: OVERRIDE' }).props.accessibilityState?.checked).toBe(true);
  });
});

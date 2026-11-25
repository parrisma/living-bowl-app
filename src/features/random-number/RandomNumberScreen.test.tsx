import { afterEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import App from '../../../App';

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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RandomNumberScreen', () => {
  it('shows compact theme and language dropdowns', async () => {
    await AsyncStorage.clear();
    const { getByRole, findByText, queryByRole } = await render(<App />);

    expect(await findByText('Hello, world!')).toBeTruthy();
    expect(await findByText('Tap the button to generate a random number.')).toBeTruthy();
    await waitFor(() => {
      expect(getByRole('button', { name: 'Theme: System' }).props.accessibilityState?.disabled).toBe(false);
    });
    expect(getByRole('button', { name: 'Generate number' })).toBeTruthy();
    expect(getByRole('button', { name: 'Language: Device (EN)' })).toBeTruthy();
    expect(queryByRole('radio', { name: 'Neon' })).toBeNull();

    await fireEvent.press(getByRole('button', { name: 'Theme: System' }));
    expect(getByRole('radio', { name: 'Neon' })).toBeTruthy();
    await fireEvent.press(getByRole('button', { name: 'Language: Device (EN)' }));
    expect(getByRole('radio', { name: 'Français (FR)' })).toBeTruthy();
  });

  it('displays the generated number after each button press', async () => {
    await AsyncStorage.clear();
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.42);
    const { getByRole, findByText } = await render(<App />);

    await fireEvent.press(getByRole('button', { name: 'Generate number' }));
    expect(await findByText('Random number: 43')).toBeTruthy();

    await fireEvent.press(getByRole('button', { name: 'Generate number' }));
    expect(random).toHaveBeenCalledTimes(2);
    expect(await findByText('Random number: 43')).toBeTruthy();
  });

  it('applies and persists selected theme and language choices', async () => {
    await AsyncStorage.clear();
    const { getByRole, findByText, unmount } = await render(<App />);

    await findByText('Hello, world!');
    await waitFor(() => {
      expect(getByRole('button', { name: 'Theme: System' }).props.accessibilityState?.disabled).toBe(false);
    });
    await fireEvent.press(getByRole('button', { name: 'Theme: System' }));
    await fireEvent.press(getByRole('radio', { name: 'Neon' }));
    await waitFor(() => {
      expect(getByRole('button', { name: 'Theme: Neon' })).toBeTruthy();
    });
    await fireEvent.press(getByRole('button', { name: 'Language: Device (EN)' }));
    await fireEvent.press(getByRole('radio', { name: 'Français (FR)' }));
    expect(await findByText('Bonjour, le monde !')).toBeTruthy();
    unmount();

    const reopened = await render(<App />);
    await waitFor(() => {
      expect(reopened.getByText('Bonjour, le monde !')).toBeTruthy();
      expect(reopened.getByRole('button', { name: 'Thème: Néon' })).toBeTruthy();
      expect(reopened.getByRole('button', { name: 'Langue: Français (FR)' })).toBeTruthy();
    });
  });
});

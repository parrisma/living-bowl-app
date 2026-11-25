import AsyncStorage from '@react-native-async-storage/async-storage';
import { isLocaleChoice, type LocaleChoice } from '../localization/locale';
import { isThemeChoice, type ThemeChoice } from '../theme/registry';

const THEME_KEY = 'app.preference.theme';
const LOCALE_KEY = 'app.preference.locale';

export type StoredPreferences = {
  themeChoice: ThemeChoice;
  localeChoice: LocaleChoice;
};

export async function loadPreferences(): Promise<StoredPreferences> {
  const entries = await AsyncStorage.multiGet([THEME_KEY, LOCALE_KEY]);
  const values = new Map(entries);
  const theme = values.get(THEME_KEY) ?? null;
  const locale = values.get(LOCALE_KEY) ?? null;

  return {
    themeChoice: isThemeChoice(theme) ? theme : 'system',
    localeChoice: isLocaleChoice(locale) ? locale : 'system',
  };
}

export function saveThemeChoice(choice: ThemeChoice): Promise<void> {
  return AsyncStorage.setItem(THEME_KEY, choice);
}

export function saveLocaleChoice(choice: LocaleChoice): Promise<void> {
  return AsyncStorage.setItem(LOCALE_KEY, choice);
}

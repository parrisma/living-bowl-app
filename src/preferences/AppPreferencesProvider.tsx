import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { loadPreferences, saveLocaleChoice, saveThemeChoice } from './storage';
import type { LocaleChoice } from '../localization/locale';
import type { ThemeChoice } from '../theme/registry';

type PreferencesContextValue = {
  themeChoice: ThemeChoice;
  localeChoice: LocaleChoice;
  isReady: boolean;
  hasError: boolean;
  setThemeChoice: (choice: ThemeChoice) => Promise<void>;
  setLocaleChoice: (choice: LocaleChoice) => Promise<void>;
  reportError: (message: string, error: unknown) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: PropsWithChildren) {
  const [themeChoice, setThemeChoiceState] = useState<ThemeChoice>('system');
  const [localeChoice, setLocaleChoiceState] = useState<LocaleChoice>('system');
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;

    loadPreferences()
      .then((preferences) => {
        if (active) {
          setThemeChoiceState(preferences.themeChoice);
          setLocaleChoiceState(preferences.localeChoice);
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to load app preferences', error);
        if (active) {
          setHasError(true);
        }
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const setThemeChoice = useCallback(async (choice: ThemeChoice) => {
    try {
      await saveThemeChoice(choice);
      setThemeChoiceState(choice);
      setHasError(false);
    } catch (error) {
      console.error('Unable to save theme preference', error);
      setHasError(true);
    }
  }, []);

  const setLocaleChoice = useCallback(async (choice: LocaleChoice) => {
    try {
      await saveLocaleChoice(choice);
      setLocaleChoiceState(choice);
      setHasError(false);
    } catch (error) {
      console.error('Unable to save language preference', error);
      setHasError(true);
    }
  }, []);

  const reportError = useCallback((message: string, error: unknown) => {
    console.error(message, error);
    setHasError(true);
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ themeChoice, localeChoice, isReady, hasError, setThemeChoice, setLocaleChoice, reportError }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function useAppPreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }
  return context;
}

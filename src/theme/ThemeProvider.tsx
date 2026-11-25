import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { useAppPreferences } from '../preferences/AppPreferencesProvider';
import { resolveTheme } from './resolve-theme';
import type { ThemeDefinition } from './types';

type ThemeContextValue = {
  theme: ThemeDefinition;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const { themeChoice } = useAppPreferences();
  const theme = resolveTheme(themeChoice, useColorScheme());

  return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

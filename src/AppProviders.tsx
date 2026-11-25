import type { PropsWithChildren } from 'react';
import { LocalizationProvider } from './localization/LocalizationProvider';
import { AppPreferencesProvider } from './preferences/AppPreferencesProvider';
import { ThemeProvider } from './theme/ThemeProvider';

export default function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppPreferencesProvider>
      <ThemeProvider>
        <LocalizationProvider>{children}</LocalizationProvider>
      </ThemeProvider>
    </AppPreferencesProvider>
  );
}

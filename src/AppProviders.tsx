import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocalizationProvider } from './localization/LocalizationProvider';
import { AppPreferencesProvider } from './preferences/AppPreferencesProvider';
import { ThemeProvider } from './theme/ThemeProvider';

export default function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <AppPreferencesProvider>
        <ThemeProvider>
          <LocalizationProvider>{children}</LocalizationProvider>
        </ThemeProvider>
      </AppPreferencesProvider>
    </SafeAreaProvider>
  );
}

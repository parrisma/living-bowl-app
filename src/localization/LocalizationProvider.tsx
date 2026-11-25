import { createContext, useContext, useEffect, type PropsWithChildren } from 'react';
import { useLocales } from 'expo-localization';
import { I18nextProvider } from 'react-i18next';
import { useAppPreferences } from '../preferences/AppPreferencesProvider';
import i18n from './i18n';
import { resolveLocale, type LocaleId } from './locale';

const LocaleContext = createContext<LocaleId | null>(null);

export function LocalizationProvider({ children }: PropsWithChildren) {
  const { localeChoice, reportError } = useAppPreferences();
  const deviceLocales = useLocales();
  const locale = resolveLocale(localeChoice, deviceLocales);

  useEffect(() => {
    i18n.changeLanguage(locale).catch((error: unknown) => {
      reportError('Unable to change app language', error);
    });
  }, [locale, reportError]);

  return (
    <I18nextProvider i18n={i18n}>
      <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
    </I18nextProvider>
  );
}

export function useAppLocale(): LocaleId {
  const locale = useContext(LocaleContext);
  if (!locale) {
    throw new Error('useAppLocale must be used within LocalizationProvider');
  }
  return locale;
}

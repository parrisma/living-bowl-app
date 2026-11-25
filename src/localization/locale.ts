export const localeIds = ['en', 'fr', 'zh-Hans', 'ja'] as const;

export type LocaleId = (typeof localeIds)[number];
export type LocaleChoice = LocaleId | 'system';

export function isLocaleChoice(value: string | null): value is LocaleChoice {
  return value === 'system' || (value !== null && localeIds.some((locale) => locale === value));
}

export function resolveLocale(
  choice: LocaleChoice,
  deviceLocales: readonly { languageTag: string }[],
): LocaleId {
  if (choice !== 'system') {
    return choice;
  }

  for (const { languageTag } of deviceLocales) {
    const parts = languageTag.replaceAll('_', '-').split('-');
    const language = parts[0]?.toLowerCase();

    if (language === 'zh') {
      const script = parts.find((part) => part.length === 4)?.toLowerCase();
      const region = parts.find((part) => part.length === 2 || part.length === 3)?.toUpperCase();
      if (script === 'hans' || region === 'CN' || region === 'SG') {
        return 'zh-Hans';
      }
      continue;
    }

    if (language === 'en' || language === 'fr' || language === 'ja') {
      return language;
    }
  }

  return 'en';
}

import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '../../localization/LocalizationProvider';
import { useAppPreferences } from '../../preferences/AppPreferencesProvider';
import { CompactDropdown, type DropdownOption } from '../../shared/ui/CompactDropdown';
import { getRandomNumber } from './random-number';
import { useTheme } from '../../theme/ThemeProvider';
import { getResponsiveTokens } from '../../theme/responsive';
import type { ThemeChoice } from '../../theme/registry';
import type { LocaleChoice } from '../../localization/locale';

const themeOptions: readonly { choice: ThemeChoice; label: string }[] = [
  { choice: 'system', label: 'themeSystem' },
  { choice: 'light', label: 'themeLight' },
  { choice: 'dark', label: 'themeDark' },
  { choice: 'neon', label: 'themeNeon' },
];

const themeLabels: Record<ThemeChoice, string> = {
  system: 'themeSystem',
  light: 'themeLight',
  dark: 'themeDark',
  neon: 'themeNeon',
};

const languageLabels: Record<LocaleChoice, string> = {
  system: 'languageSystem',
  en: 'languageEnglish',
  fr: 'languageFrench',
  'zh-Hans': 'languageChinese',
  ja: 'languageJapanese',
};

const languageOptions: readonly { choice: LocaleChoice; label: string }[] = [
  { choice: 'system', label: 'languageSystem' },
  { choice: 'en', label: 'languageEnglish' },
  { choice: 'fr', label: 'languageFrench' },
  { choice: 'zh-Hans', label: 'languageChinese' },
  { choice: 'ja', label: 'languageJapanese' },
];

export default function RandomNumberScreen() {
  const [number, setNumber] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<'theme' | 'language' | null>(null);
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const locale = useAppLocale();
  const { t } = useTranslation();
  const { themeChoice, localeChoice, isReady, hasError, setThemeChoice, setLocaleChoice } = useAppPreferences();
  const responsive = getResponsiveTokens(width);
  const languageCode = locale.slice(0, 2).toUpperCase();
  const selectedThemeLabel = t(themeLabels[themeChoice]);
  const selectedLanguageLabel = `${t(languageLabels[localeChoice])} (${languageCode})`;
  const translatedThemeOptions: DropdownOption<ThemeChoice>[] = themeOptions.map(({ choice, label }) => ({
    value: choice,
    label: t(label),
  }));
  const translatedLanguageOptions: DropdownOption<LocaleChoice>[] = languageOptions.map(({ choice, label }) => ({
    value: choice,
    label:
      choice === 'system'
        ? `${t(label)} (${languageCode})`
        : `${t(label)} (${choice.slice(0, 2).toUpperCase()})`,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: responsive.screenHorizontal,
            paddingBottom: responsive.screenVertical,
            paddingTop: responsive.screenVertical + responsive.choiceMinHeight + theme.spacing.titleGap,
          },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.shape.cardRadius,
              borderWidth: theme.shape.borderWidth,
              maxWidth: responsive.contentMaxWidth,
              padding: theme.spacing.card,
            },
          ]}
        >
          <Text
            style={[
              styles.title,
              theme.typography.title,
              {
                color: theme.colors.text,
                fontSize: Math.round(theme.typography.title.fontSize * responsive.titleScale),
                lineHeight: Math.round(theme.typography.title.lineHeight * responsive.titleScale),
                marginBottom: theme.spacing.titleGap,
              },
            ]}
          >
            {t('helloWorld')}
          </Text>
          <Text
            style={[
              styles.message,
              number === null ? theme.typography.body : theme.typography.result,
              {
                color: number === null ? theme.colors.secondaryText : theme.colors.text,
                marginBottom: theme.spacing.messageGap,
              },
            ]}
          >
            {number === null
              ? t('tapToGenerate')
              : t('randomNumber', { number: new Intl.NumberFormat(locale).format(number) })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('generateNumber')}
            onPress={() => setNumber(getRandomNumber())}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: theme.shape.buttonRadius,
                minHeight: responsive.buttonMinHeight,
                opacity: pressed ? theme.interaction.pressedOpacity : 1,
                paddingHorizontal: theme.spacing.buttonHorizontal,
                paddingVertical: theme.spacing.buttonVertical,
              },
            ]}
          >
            <Text style={[styles.buttonText, theme.typography.button, { color: theme.colors.onPrimary }]}>
              {t('generateNumber')}
            </Text>
          </Pressable>
          {hasError ? (
            <Text
              accessibilityRole="alert"
              style={[theme.typography.label, { color: theme.colors.secondaryText, marginTop: theme.spacing.titleGap }]}
            >
              {t('settingsError')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      {openDropdown ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('closeDropdown')}
          accessibilityState={{ disabled: false }}
          onPress={() => setOpenDropdown(null)}
          style={styles.dismissOverlay}
        />
      ) : null}
      <View
        style={[
          styles.topControls,
          {
            columnGap: theme.spacing.choiceGap,
            right: responsive.screenHorizontal,
            top: responsive.screenVertical,
          },
        ]}
      >
        <CompactDropdown
          accessibilityLabel={`${t('themeSetting')}: ${selectedThemeLabel}`}
          disabled={!isReady}
          expanded={openDropdown === 'theme'}
          minTouchHeight={responsive.choiceMinHeight}
          onClose={() => setOpenDropdown(null)}
          onSelect={(choice) => void setThemeChoice(choice)}
          onToggle={() => setOpenDropdown(openDropdown === 'theme' ? null : 'theme')}
          options={translatedThemeOptions}
          selectedLabel={selectedThemeLabel}
          title={t('themeSetting')}
          theme={theme}
          value={themeChoice}
        />
        <CompactDropdown
          accessibilityLabel={`${t('languageSetting')}: ${selectedLanguageLabel}`}
          disabled={!isReady}
          expanded={openDropdown === 'language'}
          minTouchHeight={responsive.choiceMinHeight}
          onClose={() => setOpenDropdown(null)}
          onSelect={(choice) => void setLocaleChoice(choice)}
          onToggle={() => setOpenDropdown(openDropdown === 'language' ? null : 'language')}
          options={translatedLanguageOptions}
          selectedLabel={languageCode}
          title={t('languageSetting')}
          theme={theme}
          value={localeChoice}
        />
      </View>
      <StatusBar style={theme.statusBarStyle} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    alignItems: 'center',
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  topControls: {
    alignItems: 'center',
    flexDirection: 'row',
    position: 'absolute',
    zIndex: 2,
  },
  message: {
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  buttonText: { textAlign: 'center' },
});

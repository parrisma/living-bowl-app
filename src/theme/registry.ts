import type { ThemeDefinition } from './types';

export const themeRegistry = {
  light: {
    statusBarStyle: 'dark',
    colors: {
      background: '#F3F6FB',
      surface: '#FFFFFF',
      text: '#152238',
      secondaryText: '#516176',
      border: '#D8E0EB',
      primary: '#2457D6',
      onPrimary: '#FFFFFF',
      accent: '#2457D6',
    },
    spacing: {
      card: 28,
      titleGap: 12,
      messageGap: 24,
      choiceGap: 8,
      choiceHorizontal: 12,
      choiceVertical: 9,
      dropdownHorizontal: 8,
      dropdownVertical: 1,
      buttonHorizontal: 24,
      buttonVertical: 14,
    },
    typography: {
      title: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
      body: { fontSize: 18, lineHeight: 28, fontWeight: '400' },
      result: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
      label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
      button: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
    },
    shape: { cardRadius: 20, buttonRadius: 12, choiceRadius: 20, borderWidth: 1, dropdownBorderWidth: 1 },
    interaction: { pressedOpacity: 0.8 },
  },
  dark: {
    statusBarStyle: 'light',
    colors: {
      background: '#0B1220',
      surface: '#151F30',
      text: '#F4F7FB',
      secondaryText: '#C2CDDB',
      border: '#344256',
      primary: '#9AB8FF',
      onPrimary: '#101827',
      accent: '#9AB8FF',
    },
    spacing: {
      card: 28,
      titleGap: 12,
      messageGap: 24,
      choiceGap: 8,
      choiceHorizontal: 12,
      choiceVertical: 9,
      dropdownHorizontal: 8,
      dropdownVertical: 1,
      buttonHorizontal: 24,
      buttonVertical: 14,
    },
    typography: {
      title: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
      body: { fontSize: 18, lineHeight: 28, fontWeight: '400' },
      result: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
      label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
      button: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
    },
    shape: { cardRadius: 20, buttonRadius: 12, choiceRadius: 20, borderWidth: 1, dropdownBorderWidth: 1 },
    interaction: { pressedOpacity: 0.8 },
  },
  neon: {
    statusBarStyle: 'light',
    colors: {
      background: '#10051F',
      surface: '#24113B',
      text: '#F8ECFF',
      secondaryText: '#D5BDEB',
      border: '#71459A',
      primary: '#FF4FD8',
      onPrimary: '#23001D',
      accent: '#5CFFE7',
    },
    spacing: {
      card: 24,
      titleGap: 14,
      messageGap: 24,
      choiceGap: 8,
      choiceHorizontal: 12,
      choiceVertical: 9,
      dropdownHorizontal: 8,
      dropdownVertical: 1,
      buttonHorizontal: 24,
      buttonVertical: 14,
    },
    typography: {
      title: { fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: 1 },
      body: { fontSize: 18, lineHeight: 28, fontWeight: '400' },
      result: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
      label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
      button: { fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: 0.5 },
    },
    shape: { cardRadius: 8, buttonRadius: 8, choiceRadius: 4, borderWidth: 2, dropdownBorderWidth: 1 },
    interaction: { pressedOpacity: 0.75 },
  },
} satisfies Record<string, ThemeDefinition>;

export type ThemeId = keyof typeof themeRegistry;
export type ThemeChoice = ThemeId | 'system';

export function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === 'system' || (value !== null && Object.prototype.hasOwnProperty.call(themeRegistry, value));
}

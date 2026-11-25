export type FontWeight = '400' | '500' | '600' | '700';

export type ThemeDefinition = {
  statusBarStyle: 'light' | 'dark';
  colors: {
    background: string;
    surface: string;
    text: string;
    secondaryText: string;
    border: string;
    primary: string;
    onPrimary: string;
    accent: string;
  };
  spacing: {
    card: number;
    titleGap: number;
    messageGap: number;
    choiceGap: number;
    choiceHorizontal: number;
    choiceVertical: number;
    dropdownHorizontal: number;
    dropdownVertical: number;
    buttonHorizontal: number;
    buttonVertical: number;
  };
  typography: {
    title: { fontSize: number; lineHeight: number; fontWeight: FontWeight; letterSpacing?: number };
    body: { fontSize: number; lineHeight: number; fontWeight: FontWeight };
    result: { fontSize: number; lineHeight: number; fontWeight: FontWeight };
    label: { fontSize: number; lineHeight: number; fontWeight: FontWeight };
    button: { fontSize: number; lineHeight: number; fontWeight: FontWeight; letterSpacing?: number };
  };
  shape: {
    cardRadius: number;
    buttonRadius: number;
    choiceRadius: number;
    borderWidth: number;
    dropdownBorderWidth: number;
  };
  interaction: {
    pressedOpacity: number;
  };
};

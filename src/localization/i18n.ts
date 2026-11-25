import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './catalogs/en.json';
import fr from './catalogs/fr.json';
import ja from './catalogs/ja.json';
import zhHans from './catalogs/zh-Hans.json';

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    'zh-Hans': { translation: zhHans },
    ja: { translation: ja },
  },
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'fr', 'zh-Hans', 'ja'],
  interpolation: { escapeValue: false },
  initAsync: false,
  react: { useSuspense: false },
});

export default i18n;

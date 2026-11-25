import { describe, expect, it } from '@jest/globals';
import { resolveLocale } from './locale';
import en from './catalogs/en.json';
import fr from './catalogs/fr.json';
import ja from './catalogs/ja.json';
import zhHans from './catalogs/zh-Hans.json';

describe('resolveLocale', () => {
  it('uses an explicit override before device locales', () => {
    expect(resolveLocale('ja', [{ languageTag: 'fr-FR' }])).toBe('ja');
  });

  it('matches supported language variants and falls back to English', () => {
    expect(resolveLocale('system', [{ languageTag: 'fr-CA' }])).toBe('fr');
    expect(resolveLocale('system', [{ languageTag: 'zh-Hans-CN' }])).toBe('zh-Hans');
    expect(resolveLocale('system', [{ languageTag: 'de-DE' }, { languageTag: 'ja-JP' }])).toBe('ja');
    expect(resolveLocale('system', [{ languageTag: 'zh-Hant-TW' }])).toBe('en');
  });

  it('keeps translation keys aligned across the shipped catalogs', () => {
    const keys = Object.keys(en).sort();
    expect(Object.keys(fr).sort()).toEqual(keys);
    expect(Object.keys(zhHans).sort()).toEqual(keys);
    expect(Object.keys(ja).sort()).toEqual(keys);
  });
});

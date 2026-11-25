import { describe, expect, it } from '@jest/globals';
import { themeRegistry } from './theme/registry';
import { resolveTheme } from './theme/resolve-theme';
import { getResponsiveTokens } from './theme/responsive';

describe('theme registry and resolver', () => {
  it('provides complete light, dark, and neon themes', () => {
    expect(Object.keys(themeRegistry).sort()).toEqual(['dark', 'light', 'neon']);

    for (const theme of Object.values(themeRegistry)) {
      expect(theme.colors.background).toBeTruthy();
      expect(theme.colors.surface).toBeTruthy();
      expect(theme.colors.text).toBeTruthy();
      expect(theme.colors.primary).toBeTruthy();
      expect(theme.typography.title.fontSize).toBeGreaterThan(0);
      expect(theme.spacing.card).toBeGreaterThan(0);
      expect(theme.shape.cardRadius).toBeGreaterThan(0);
      expect(contrastRatio(theme.colors.text, theme.colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.colors.text, theme.colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.colors.secondaryText, theme.colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.colors.secondaryText, theme.colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.colors.onPrimary, theme.colors.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.colors.accent, theme.colors.surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it('resolves system appearance without treating system as a theme', () => {
    expect(resolveTheme('system', 'dark')).toBe(themeRegistry.dark);
    expect(resolveTheme('system', 'light')).toBe(themeRegistry.light);
    expect(resolveTheme('neon', 'light')).toBe(themeRegistry.neon);
  });
});

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const channels = color.match(/[A-Fa-f0-9]{2}/g)?.map((channel) => parseInt(channel, 16) / 255);
    if (!channels || channels.length !== 3) {
      throw new Error(`Expected a six-digit hex color, received ${color}`);
    }

    const [red, green, blue] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('responsive layout tokens', () => {
  it('adapts compact spacing and constrains wide layouts independently', () => {
    const compact = getResponsiveTokens(320);
    const regular = getResponsiveTokens(390);
    const wide = getResponsiveTokens(768);

    expect(compact.screenHorizontal).toBeLessThan(regular.screenHorizontal);
    expect(compact.titleScale).toBeLessThan(regular.titleScale);
    expect(wide.contentMaxWidth).toBeLessThan(768);
  });
});

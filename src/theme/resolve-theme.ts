import { themeRegistry, type ThemeChoice } from './registry';
import type { ThemeDefinition } from './types';

export function resolveTheme(
  choice: ThemeChoice,
  systemScheme: 'light' | 'dark' | null,
): ThemeDefinition {
  const id = choice === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : choice;
  return themeRegistry[id];
}

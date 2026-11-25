export type ResponsiveTokens = {
  screenHorizontal: number;
  screenVertical: number;
  contentMaxWidth: number;
  buttonMinHeight: number;
  choiceMinHeight: number;
  titleScale: number;
};

export function getResponsiveTokens(width: number): ResponsiveTokens {
  const compact = width < 360;
  const wide = width >= 600;

  return {
    screenHorizontal: compact ? 16 : wide ? 32 : 24,
    screenVertical: compact ? 16 : 24,
    contentMaxWidth: wide ? 520 : 480,
    buttonMinHeight: 48,
    choiceMinHeight: 44,
    titleScale: compact ? 0.9 : 1,
  };
}

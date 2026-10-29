export type MacroKey = 'protein' | 'fat' | 'carbs';

export const macroFillClass: Record<MacroKey, string> = {
  protein: 'bg-macro-protein',
  fat: 'bg-macro-fat',
  carbs: 'bg-macro-carbs',
};

export const macroRingBackground = (macro: MacroKey, percent: number) =>
  `conic-gradient(rgb(var(--color-macro-${macro})) ${percent}%, rgb(var(--color-macro-${macro}) / 0.06) 0)`;

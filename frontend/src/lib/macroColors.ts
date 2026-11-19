export type MacroKey = 'protein' | 'fat' | 'carbs';

export const macroFillClass: Record<MacroKey, string> = {
  protein: 'bg-macro-protein',
  fat: 'bg-macro-fat',
  carbs: 'bg-macro-carbs',
};

export const macroTextClass: Record<MacroKey, string> = {
  protein: 'text-macro-protein',
  fat: 'text-macro-fat',
  carbs: 'text-macro-carbs',
};

export const macroRingBackground = (macro: MacroKey, percent: number) =>
  `conic-gradient(var(--color-macro-${macro}) ${percent}%, var(--color-surface-container-highest) 0)`;

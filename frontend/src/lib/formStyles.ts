import type { KeyboardEvent } from 'react';

export const FIELD_CLASS =
  'w-full h-12 bg-surface-container rounded-2xl px-4 text-on-surface font-medium text-[15px] outline-hidden border-[1.5px] border-transparent focus:border-primary caret-primary placeholder:text-on-surface-variant/60 transition-colors';
export const LABEL_CLASS = 'block mb-1.5 px-1 text-[13px] font-semibold text-on-surface-variant';
export const SECTION_LABEL_CLASS = 'text-[13.5px] font-bold text-on-surface-variant';
export const ERROR_NOTE_CLASS = 'rounded-2xl px-3.5 py-3 text-[13px] font-medium bg-error/10 text-error';

export const blockNumberSigns = (event: KeyboardEvent<HTMLInputElement>) => {
  if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
};

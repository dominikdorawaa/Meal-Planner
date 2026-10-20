export const KCAL_HERO_SIZES = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'] as const;
export const COMPACT_KCAL_SIZES = ['text-[clamp(10px,3.3vw,12px)]', 'text-[clamp(9px,2.9vw,11px)]', 'text-[clamp(8px,2.6vw,10px)]', 'text-[clamp(7px,2.3vw,9px)]'] as const;
export const COMPACT_MACRO_SIZES = ['text-[clamp(9px,2.9vw,10px)]', 'text-[clamp(8px,2.6vw,9px)]', 'text-[clamp(7px,2.3vw,8px)]'] as const;
export const RING_VALUE_SIZES = ['text-base', 'text-sm', 'text-xs', 'text-[10px]'] as const;

export function fitTextClass(text: string, sizes: readonly string[], fullSizeLength: number): string {
  const step = Math.max(0, text.length - fullSizeLength);
  return sizes[Math.min(sizes.length - 1, step)];
}

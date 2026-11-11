export const KCAL_HERO_SIZES = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'] as const;
export const COMPACT_KCAL_SIZES = ['text-[clamp(17px,5.6vw,21px)]', 'text-[clamp(15px,4.8vw,18px)]', 'text-[clamp(13px,4.2vw,16px)]', 'text-[clamp(11px,3.6vw,14px)]'] as const;
export const COMPACT_MACRO_SIZES = ['text-[clamp(8.5px,2.7vw,9.5px)]', 'text-[clamp(7.5px,2.4vw,8.5px)]', 'text-[clamp(7px,2.2vw,8px)]'] as const;
export const RING_VALUE_SIZES = ['text-base', 'text-sm', 'text-xs', 'text-[10px]'] as const;

export function fitTextClass(text: string, sizes: readonly string[], fullSizeLength: number): string {
  const step = Math.max(0, text.length - fullSizeLength);
  return sizes[Math.min(sizes.length - 1, step)];
}

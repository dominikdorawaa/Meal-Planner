export const KCAL_HERO_SIZES = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'] as const;
export const RING_VALUE_SIZES = ['text-base', 'text-sm', 'text-xs', 'text-[10px]'] as const;

export function fitTextClass(text: string, sizes: readonly string[], fullSizeLength: number): string {
  const step = Math.max(0, text.length - fullSizeLength);
  return sizes[Math.min(sizes.length - 1, step)];
}

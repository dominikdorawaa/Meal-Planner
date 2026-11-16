export type FoodPlaceholderKind = 'product' | 'manual';

const ICONS: Record<FoodPlaceholderKind, string> = { product: 'nutrition', manual: 'bolt' };
const FILLED = { fontVariationSettings: "'FILL' 1" };

export function FoodPlaceholder({
  kind,
  className = '',
  iconClassName = 'text-[24px]',
}: {
  kind: FoodPlaceholderKind;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      data-testid="food-placeholder"
      data-kind={kind}
      className={`flex items-center justify-center bg-gradient-to-br from-[#f1f3f0] to-[#d9e6dc] dark:from-[#181818] dark:to-[#1f2a20] ${className}`}
    >
      <span
        aria-hidden="true"
        style={FILLED}
        className={`material-symbols-outlined leading-none text-primary/[0.22] dark:text-primary/30 ${iconClassName}`}
      >
        {ICONS[kind]}
      </span>
    </span>
  );
}

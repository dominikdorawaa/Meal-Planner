import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../../i18n';
import { registerOverlay } from '../../lib/backNavigation';

type SettingsPageProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  depth?: number;
};

export function SettingsPage({ title, onBack, children, footer, action, depth = 0 }: SettingsPageProps) {
  const latestBack = useRef(onBack);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    latestBack.current = onBack;
  });
  useEffect(
    () =>
      registerOverlay(() => {
        latestBack.current();
        setGeneration(current => current + 1);
      }),
    [generation]
  );

  return (
    <div
      data-scroll-lock
      role="region"
      aria-label={title}
      style={{ zIndex: 100 + depth }}
      className="fixed inset-0 bg-surface flex flex-col animate-in fade-in slide-in-from-right-4 duration-200"
    >
      <header className="pt-safe shrink-0">
        <div className="h-16 max-w-xl mx-auto px-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            aria-label={t('settings.back')}
            className="w-11 h-11 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container active:bg-surface-container-high transition-colors"
          >
            <span aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="flex-1 min-w-0 truncate font-headline font-extrabold text-[22px] tracking-tight text-on-surface">{title}</h2>
          {action}
        </div>
      </header>
      <div className={`flex-1 overflow-y-auto no-scrollbar ${footer ? 'pb-[calc(6.5rem+env(safe-area-inset-bottom))]' : 'pb-[calc(2rem+env(safe-area-inset-bottom))]'}`}>
        <div className="max-w-xl mx-auto px-4">{children}</div>
      </div>
      {footer && (
        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-surface via-surface to-surface/0 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-xl mx-auto px-4 flex gap-2">{footer}</div>
        </div>
      )}
    </div>
  );
}

export function SettingsSectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-5 mb-1.5 px-1 flex items-center justify-between gap-3">
      <h3 className="text-[13.5px] font-bold text-on-surface-variant">{children}</h3>
      {action}
    </div>
  );
}

export function SettingsGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-low rounded-[22px] px-3.5 divide-y divide-outline-variant/10 ${className}`}>{children}</div>
  );
}

type SettingsRowProps = {
  icon?: string;
  label: string;
  value?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  chevron?: boolean;
};

export function SettingsRow({ icon, label, value, onClick, danger = false, chevron = !danger }: SettingsRowProps) {
  const content = (
    <>
      {icon && (
        <span aria-hidden="true" className={`material-symbols-outlined text-[22px] ${danger ? 'text-error' : 'text-on-surface-variant'}`}>{icon}</span>
      )}
      <span className={`shrink-0 text-left text-base font-medium ${danger ? 'text-error' : 'text-on-surface'}`}>{label}</span>
      <span className="flex-1 min-w-0 truncate text-right text-sm text-on-surface-variant tabular-nums">{value}</span>
      {chevron && <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant/50">chevron_right</span>}
    </>
  );

  if (!onClick) {
    return <div className="min-h-[52px] flex items-center gap-3.5">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[52px] flex items-center gap-3.5 transition-opacity active:opacity-60"
    >
      {content}
    </button>
  );
}

type PrimaryButtonProps = {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: string;
};

export function PrimaryButton({ children, onClick, disabled = false, icon }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 h-[52px] rounded-full bg-primary text-on-primary font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:bg-surface-container-highest disabled:text-on-surface-variant/50 disabled:active:scale-100"
    >
      {children}
      {icon && <span aria-hidden="true" className="material-symbols-outlined text-[20px]">{icon}</span>}
    </button>
  );
}

export function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-[52px] px-6 rounded-full bg-surface-container-high text-on-surface font-bold text-base active:scale-[0.98] transition-transform"
    >
      {children}
    </button>
  );
}

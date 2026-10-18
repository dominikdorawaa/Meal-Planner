import { useEffect } from 'react';
import { t } from '../i18n';

export type PlanConflictItem = { id: string; title: string; detail: string };

type PlanConflictDialogProps = {
  conflicts: PlanConflictItem[];
  busy?: boolean;
  onOverwrite: () => void;
  onAppend: () => void;
  onCancel: () => void;
};

export function PlanConflictDialog({ conflicts, busy = false, onOverwrite, onAppend, onCancel }: PlanConflictDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[230] flex items-center justify-center p-4 animate-fade-in" onClick={busy ? undefined : onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="plan-conflict-title" aria-describedby="plan-conflict-description" className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-[340px] w-full border border-outline-variant/20 text-center flex flex-col max-h-[85vh] animate-slide-up" onClick={event => event.stopPropagation()}>
        <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 shrink-0">
          <span className="material-symbols-outlined text-[28px]">content_copy</span>
        </div>
        <h3 id="plan-conflict-title" className="font-headline font-bold text-lg text-on-surface mb-2 tracking-tight">{t('plan.conflict.title')}</h3>
        <p id="plan-conflict-description" className="text-on-surface-variant text-xs mb-5 leading-relaxed">{t('plan.conflict.description')}</p>

        <ul className="flex flex-col gap-2 overflow-y-auto w-full mb-6 pr-1">
          {conflicts.map(conflict => (
            <li key={conflict.id} className="flex flex-col p-3 bg-surface-container-low rounded-2xl w-full text-left overflow-hidden">
              <span className="text-xs font-bold text-on-surface truncate">{conflict.title}</span>
              <span className="text-[10px] text-on-surface-variant font-medium truncate mt-0.5">{conflict.detail}</span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-3 gap-2 shrink-0">
          <button type="button" autoFocus disabled={busy} onClick={onCancel} className="py-3.5 text-sm font-bold text-on-surface-variant bg-surface-container-low hover:bg-surface-container-highest rounded-2xl transition-colors active:scale-95 disabled:opacity-50">
            {t('plan.cancel')}
          </button>
          <button type="button" disabled={busy} onClick={onAppend} className="py-3.5 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-2xl transition-colors active:scale-95 disabled:opacity-50">
            {t('plan.conflict.append')}
          </button>
          <button type="button" disabled={busy} onClick={onOverwrite} className="py-3.5 text-sm font-bold text-on-error bg-error hover:bg-error/90 rounded-2xl shadow-sm transition-colors active:scale-95 disabled:opacity-50">
            {t('plan.conflict.overwrite')}
          </button>
        </div>
      </div>
    </div>
  );
}

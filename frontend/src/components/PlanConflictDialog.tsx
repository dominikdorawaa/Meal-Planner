import { t } from '../i18n';
import { ConfirmSheet } from './ConfirmSheet';

export type PlanConflictItem = { id: string; title: string; detail: string };

type PlanConflictDialogProps = {
  conflicts: PlanConflictItem[];
  busy?: boolean;
  onOverwrite: () => void;
  onAppend: () => void;
  onCancel: () => void;
};

export function PlanConflictDialog({ conflicts, busy = false, onOverwrite, onAppend, onCancel }: PlanConflictDialogProps) {
  return (
    <ConfirmSheet
      title={t('plan.conflict.title')}
      description={t('plan.conflict.description')}
      confirmLabel={t('plan.conflict.overwrite')}
      cancelLabel={t('plan.cancel')}
      busy={busy}
      secondaryAction={{ label: t('plan.conflict.append'), onClick: onAppend }}
      onConfirm={onOverwrite}
      onCancel={onCancel}
    >
      <ul className="flex flex-col">
        {conflicts.map(conflict => (
          <li key={conflict.id} className="py-2.5 border-b border-outline-variant/10 last:border-b-0 min-w-0">
            <span className="block font-semibold text-[15px] text-on-surface truncate">{conflict.title}</span>
            <span className="block text-sm text-on-surface-variant truncate">{conflict.detail}</span>
          </li>
        ))}
      </ul>
    </ConfirmSheet>
  );
}

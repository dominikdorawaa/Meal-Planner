import { t } from '../i18n';

interface BarcodeLookupPendingProps {
  onCancel: () => void;
}

export function BarcodeLookupPending({ onCancel }: BarcodeLookupPendingProps) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-6"
    >
      <div className="bg-surface-container-lowest rounded-[24px] p-6 w-full max-w-sm flex flex-col items-center gap-4">
        <p className="text-sm font-medium text-on-surface">{t('scanner.lookingUp')}</p>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 rounded-full text-sm font-bold text-primary bg-primary/10 active:scale-95"
        >
          {t('scanner.cancel')}
        </button>
      </div>
    </div>
  );
}

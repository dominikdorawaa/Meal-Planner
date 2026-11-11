type ManualGoalNoticeProps = {
  title: string;
  text: string;
  action: string;
  onAction: () => void;
  className?: string;
};

export function ManualGoalNotice({ title, text, action, onAction, className = '' }: ManualGoalNoticeProps) {
  return (
    <div role="note" className={`rounded-[18px] border-[1.5px] border-error/30 bg-error/[0.06] p-3.5 flex gap-3 ${className}`}>
      <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-error">lock</span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-on-surface">{title}</p>
        <p className="mt-1 text-[13.5px] leading-snug text-on-surface-variant">{text}</p>
        <button type="button" onClick={onAction} className="mt-1.5 -ml-1 px-1 py-1 inline-flex items-center gap-0.5 text-[13.5px] font-semibold text-primary rounded-lg">
          {action}
          <span aria-hidden="true" className="material-symbols-outlined text-base">chevron_right</span>
        </button>
      </div>
    </div>
  );
}

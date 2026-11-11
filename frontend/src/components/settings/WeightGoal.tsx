import { t, type MessageKey } from '../../i18n';
import { KCAL_PER_KG_WEEKLY, PACE_MAX, PACE_MIN, PACE_STEP, RECOMMENDED_PACE, goalEta, weightGoal, type WeightGoal } from '../../lib/calorieTarget';
import { NumberStepper } from './NumberStepper';
import { formatLongDate, formatPace, formatShortDate, formatWeight } from './settingsFormat';

const GOAL_LABEL: Record<WeightGoal, MessageKey> = {
  reduce: 'settings.goal.reduce',
  maintain: 'settings.goal.maintain',
  build: 'settings.goal.build',
};

type WeightGoalCardProps = {
  weight: number;
  targetWeight: number;
  pace: number;
  onOpen: () => void;
  today?: Date;
};

export function WeightGoalCard({ weight, targetWeight, pace, onOpen, today }: WeightGoalCardProps) {
  const goal = weightGoal(weight, targetWeight);
  const eta = goalEta(weight, targetWeight, pace, today);

  return (
    <button type="button" onClick={onOpen} className="w-full text-left bg-surface-container-lowest rounded-[22px] p-4 active:scale-[0.99] transition-transform">
      <span className="flex items-center justify-between text-[13.5px] font-semibold text-on-surface-variant">
        {t('settings.weightGoal')}
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant/50">chevron_right</span>
      </span>
      <span className="mt-2 flex items-end justify-between gap-3">
        <span className="font-headline font-extrabold tracking-tight text-[32px] leading-none tabular-nums text-on-surface">
          {formatWeight(weight)}
          <span aria-hidden="true" className="text-on-surface-variant text-[22px] mx-1.5 align-[4px]">→</span>
          <span className="sr-only"> → </span>
          <span className="text-primary">{formatWeight(targetWeight)}</span>
          <span className="ml-1 font-body text-[15px] font-semibold tracking-normal text-on-surface-variant">{t('settings.unit.kg')}</span>
        </span>
        <span className="shrink-0 rounded-full bg-primary text-on-primary text-[13px] font-bold px-2.5 py-1">{t(GOAL_LABEL[goal])}</span>
      </span>
      <span className="mt-3.5 pt-3 border-t border-outline-variant/10 flex items-center gap-2 text-sm text-on-surface-variant">
        <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">event</span>
        {eta ? (
          <span>
            {t('settings.etaLine')} <b className="font-semibold text-on-surface">{formatShortDate(eta.date)}</b> ({t('settings.weeksShort', { weeks: eta.weeks })})
          </span>
        ) : (
          <span>{t('settings.maintainLine')}</span>
        )}
      </span>
    </button>
  );
}

type PaceChoiceProps = {
  value: number;
  onChange: (pace: number) => void;
  disabled?: boolean;
};

export function PaceChoice({ value, onChange, disabled = false }: PaceChoiceProps) {
  return (
    <div className="min-h-[66px] flex items-center justify-between gap-3">
      <span className="text-base font-medium text-on-surface">{t('settings.weight.paceRow')}</span>
      <NumberStepper label={t('settings.weight.pace')} value={value} onChange={onChange} min={PACE_MIN} max={PACE_MAX} step={PACE_STEP} decimals={1} unit={t('settings.unit.kg')} disabled={disabled} />
    </div>
  );
}

type GoalEtaSummaryProps = {
  weight: number;
  targetWeight: number;
  pace: number;
  today?: Date;
};

export function GoalEtaSummary({ weight, targetWeight, pace, today }: GoalEtaSummaryProps) {
  const eta = goalEta(weight, targetWeight, pace, today);
  if (!eta) return null;
  const sign = weightGoal(weight, targetWeight) === 'reduce' ? '−' : '+';
  const longDate = formatLongDate(eta.date);

  return (
    <section aria-label={t('settings.weight.etaTitle')} className="mt-4 rounded-[22px] bg-primary/[0.08] px-4 py-[18px]">
      <h3 className="text-[13.5px] font-semibold text-on-surface-variant">{t('settings.weight.etaTitle')}</h3>
      <p className="mt-1.5 font-headline font-extrabold tracking-tight text-[30px] leading-none text-primary">{longDate}</p>
      <dl className="mt-4 pt-3.5 border-t border-primary/15 grid grid-cols-3">
        <div className="flex flex-col-reverse gap-0.5">
          <dt className="text-[12.5px] text-on-surface-variant">{t('settings.weight.etaWeeks')}</dt>
          <dd className="font-headline font-extrabold text-[17px] tabular-nums">{t('settings.weeksShort', { weeks: eta.weeks })}</dd>
        </div>
        <div className="flex flex-col-reverse gap-0.5 pl-3 border-l border-primary/15">
          <dt className="text-[12.5px] text-on-surface-variant">{t('settings.weight.etaTarget', { target: formatWeight(targetWeight) })}</dt>
          <dd className="font-headline font-extrabold text-[17px] tabular-nums">{sign}{formatWeight(eta.kilograms)} {t('settings.unit.kg')}</dd>
        </div>
        <div className="flex flex-col-reverse gap-0.5 pl-3 border-l border-primary/15">
          <dt className="text-[12.5px] text-on-surface-variant">{t('settings.weight.etaKcal')}</dt>
          <dd className="font-headline font-extrabold text-[17px] tabular-nums">{sign}{Math.round(pace * KCAL_PER_KG_WEEKLY)}</dd>
        </div>
      </dl>
    </section>
  );
}

type PaceHintProps = {
  goal: WeightGoal;
};

export function PaceHint({ goal }: PaceHintProps) {
  return (
    <p className="pb-3 text-[13.5px] leading-snug text-on-surface-variant">
      <b className="font-semibold text-on-surface">{t('settings.weight.recommendedPace', { pace: formatPace(RECOMMENDED_PACE) })}</b>{' '}
      {t(goal === 'build' ? 'settings.weight.recommendedWhyBuild' : 'settings.weight.recommendedWhyReduce')}
    </p>
  );
}

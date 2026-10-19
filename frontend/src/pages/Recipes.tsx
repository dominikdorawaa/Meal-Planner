import { useState, useMemo } from 'react';
import { BottomNav } from '../components/BottomNav';
import { useAppData } from '../lib/AppDataContext';
import { useNavigate } from 'react-router-dom';
import { RecipeCoverImage } from '../components/RecipeCoverImage';
import { useBottomSheet } from '../lib/bottomSheet';
import { pluralForm, t, type MessageKey } from '../i18n';

type QuickPreset = 'quick' | 'highprotein' | 'lowcarb' | 'lowcal' | 'lowfat';

type PrepTimeFilter = number | '' | 'long';

interface Filters {
  maxKcal: number | '';
  minProtein: number | '';
  maxCarbs: number | '';
  maxPrepTime: PrepTimeFilter;
  quick: QuickPreset[];
}

const DEFAULT_FILTERS: Filters = {
  maxKcal: '',
  minProtein: '',
  maxCarbs: '',
  maxPrepTime: '',
  quick: [],
};

const QUICK_FILTERS: { val: QuickPreset; icon: string }[] = [
  { val: 'quick', icon: 'bolt' },
  { val: 'highprotein', icon: 'fitness_center' },
  { val: 'lowcarb', icon: 'grain' },
  { val: 'lowcal', icon: 'local_fire_department' },
  { val: 'lowfat', icon: 'water_drop' },
];

const PREP_TIME_OPTIONS: PrepTimeFilter[] = [15, 30, 45, 60, 'long'];

function roundMacro(value: unknown): number {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function toggleQuickPreset(list: QuickPreset[], val: QuickPreset): QuickPreset[] {
  return list.includes(val) ? list.filter(x => x !== val) : [...list, val];
}

export function Recipes() {
  const { recipes, loading } = useAppData();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [pendingFilters, setPendingFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const filtersSheetRef = useBottomSheet(showFilters, () => setShowFilters(false));

  const activeFilterCount =
    (filters.maxKcal !== '' ? 1 : 0) +
    (filters.minProtein !== '' ? 1 : 0) +
    (filters.maxCarbs !== '' ? 1 : 0) +
    (filters.maxPrepTime !== '' ? 1 : 0) +
    filters.quick.length;

  const hasSearch = search.trim().length > 0;
  const hasAnyConstraint = activeFilterCount > 0 || hasSearch;

  const chipBase =
    'flex-none flex items-center gap-1.5 py-2.5 px-3.5 rounded-full font-bold text-xs border-2 transition-all active:scale-95 whitespace-nowrap snap-start min-h-[40px]';
  const chipInactive = 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant';
  const chipActive = 'border-primary bg-primary/10 text-primary shadow-sm';

  const filtered = useMemo(() => {
    let list = [...recipes];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.name?.toLowerCase().includes(q));
    }

    const q = filters.quick;
    if (q.includes('quick')) list = list.filter(r => Number(r.prep_time || 99) <= 20);
    if (q.includes('highprotein')) list = list.filter(r => Number(r.protein) >= 25);
    if (q.includes('lowcarb')) list = list.filter(r => Number(r.carbs) <= 20);
    if (q.includes('lowcal')) list = list.filter(r => Number(r.kcal) <= 400);
    if (q.includes('lowfat')) list = list.filter(r => Number(r.fat) <= 10);

    if (filters.maxKcal !== '') list = list.filter(r => Number(r.kcal) <= Number(filters.maxKcal));
    if (filters.minProtein !== '') list = list.filter(r => Number(r.protein) >= Number(filters.minProtein));
    if (filters.maxCarbs !== '') list = list.filter(r => Number(r.carbs) <= Number(filters.maxCarbs));
    if (filters.maxPrepTime === 'long') {
      list = list.filter(r => Number(r.prep_time || 0) >= 60);
    } else if (filters.maxPrepTime !== '') {
      list = list.filter(r => Number(r.prep_time || 0) <= Number(filters.maxPrepTime));
    }

    list.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'pl', { sensitivity: 'base' })
    );

    return list;
  }, [recipes, search, filters]);

  const openFilters = () => {
    setPendingFilters({ ...filters });
    setShowFilters(true);
  };

  const applyFilters = () => {
    setFilters({ ...pendingFilters });
    setShowFilters(false);
  };

  const resetFilters = () => {
    setPendingFilters({ ...DEFAULT_FILTERS });
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32">

      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10 pt-safe">
        <div className="flex items-center justify-between px-5 h-16 w-full max-w-2xl mx-auto">
          <h1 className="font-headline font-bold text-xl tracking-tight text-primary">{t('recipes.title')}</h1>
          <button
            onClick={() => navigate('/add-recipe')}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('recipes.new')}
          </button>
        </div>
      </header>

      <main className="pt-[calc(5rem+env(safe-area-inset-top))] px-5 max-w-2xl mx-auto">

        <div className="flex gap-3 items-center py-4">
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant/50">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface-container-low rounded-2xl py-3 pl-12 pr-10 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-medium text-sm placeholder:text-on-surface-variant/40 transition-all"
              placeholder={t('recipes.searchPlaceholder')}
              aria-label={t('recipes.searchPlaceholder')}
              type="text"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label={t('recipes.clearSearch')} className="absolute inset-y-0 right-3 flex items-center text-on-surface-variant/50 active:scale-90">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <button
            onClick={openFilters}
            className={`relative p-3 rounded-2xl transition-all active:scale-95 ${activeFilterCount > 0 ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant'}`}
            aria-label={t('recipes.filters.open')}
          >
            <span className="material-symbols-outlined text-[22px]">tune</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-on-error text-[10px] font-black rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {!loading && (
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              {t(`recipes.count.${pluralForm(filtered.length)}` as MessageKey, { count: filtered.length })}
              {hasSearch && (
                <span className="font-medium normal-case tracking-normal text-on-surface-variant/80 block mt-1">
                  {t('recipes.countFor', { query: search.trim() })}
                </span>
              )}
            </span>
            {hasAnyConstraint && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilters({ ...DEFAULT_FILTERS });
                }}
                className="text-[11px] font-bold text-primary flex items-center gap-1 active:scale-95 shrink-0 self-start"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                {t('recipes.clearAll')}
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary/50">{t('recipes.loading')}</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-primary/30 text-4xl">menu_book</span>
            </div>
            <div>
              <p className="font-bold text-on-surface text-base">{search || activeFilterCount > 0 ? t('recipes.empty.noResults') : t('recipes.empty.title')}</p>
              <p className="text-sm text-on-surface-variant mt-1">
                {search || activeFilterCount > 0 ? t('recipes.empty.noResultsHint') : t('recipes.empty.hint')}
              </p>
            </div>
            {!search && activeFilterCount === 0 && (
              <button
                onClick={() => navigate('/add-recipe')}
                className="mt-2 flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                {t('recipes.empty.add')}
              </button>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-4 pb-4">
            {filtered.map(recipe => (
              <div
                key={recipe.id}
                className="group cursor-pointer bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/5 active:scale-[0.97] transition-all"
                onClick={() => navigate(`/recipe/${recipe.id}`)}
              >
                <div className="aspect-[4/3] w-full bg-surface-container-low relative overflow-hidden">
                  <RecipeCoverImage
                    recipe={recipe}
                    alt={recipe.name}
                    className="absolute inset-0 w-full h-full"
                    imgClassName="w-full h-full object-cover group-active:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1">
                    <span className="material-symbols-outlined text-[11px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                    <span className="text-[11px] font-black text-white">{Math.round(Number(recipe.kcal) || 0)} kcal</span>
                  </div>
                  {recipe.saved && (
                    <div className="absolute top-2 right-2 w-7 h-7 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center" aria-label={t('recipes.savedBadge')}>
                      <span className="material-symbols-outlined text-[16px] text-rose-400" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                    </div>
                  )}
                  {Number(recipe.prep_time) > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1">
                      <span className="material-symbols-outlined text-[11px] text-white/80">timer</span>
                      <span className="text-[11px] font-bold text-white/90">{t('recipes.minutes', { count: recipe.prep_time })}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 pb-3.5">
                  <h3 className="font-headline font-bold text-sm text-on-surface leading-snug mb-2 line-clamp-2">{recipe.name}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-full">{t('recipes.macro.protein', { value: roundMacro(recipe.protein) })}</span>
                    <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-full">{t('recipes.macro.carbs', { value: roundMacro(recipe.carbs) })}</span>
                    <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-full">{t('recipes.macro.fat', { value: roundMacro(recipe.fat) })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      {showFilters && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowFilters(false)}
        >
          <div
            ref={filtersSheetRef}
            className="w-full max-w-xl bg-surface rounded-t-[32px] animate-slide-up shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="overflow-y-auto flex-1 min-h-0 px-6 pt-6 pb-2">
              <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-5" />

              <div className="flex items-center justify-between mb-5">
                <h2 className="font-headline font-bold text-xl text-on-surface pr-2">{t('recipes.filters.title')}</h2>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-bold text-primary active:scale-95 flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                  {t('recipes.filters.reset')}
                </button>
              </div>

              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{t('recipes.filters.quickTitle')}</p>
              <p className="text-[11px] text-on-surface-variant/85 leading-snug mt-1 mb-3">
                {t('recipes.filters.quickHint')}
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {QUICK_FILTERS.map(qf => (
                  <button
                    key={qf.val}
                    type="button"
                    title={t(`recipes.filters.quick.${qf.val}.hint` as MessageKey)}
                    aria-pressed={pendingFilters.quick.includes(qf.val)}
                    onClick={() =>
                      setPendingFilters(prev => ({
                        ...prev,
                        quick: toggleQuickPreset(prev.quick, qf.val),
                      }))
                    }
                    className={`${chipBase} ${
                      pendingFilters.quick.includes(qf.val) ? chipActive : chipInactive
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] shrink-0">{qf.icon}</span>
                    {t(`recipes.filters.quick.${qf.val}` as MessageKey)}
                  </button>
                ))}
              </div>

              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{t('recipes.filters.valuesTitle')}</p>
              <p className="text-[11px] text-on-surface-variant/85 leading-snug mt-1 mb-3">
                {t('recipes.filters.valuesHint')}
              </p>
              <div className="space-y-3 mb-2">

              <div className="bg-surface-container-low rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                    {t('recipes.filters.kcal')}
                  </span>
                  <span className="text-sm font-black text-primary">{pendingFilters.maxKcal ? t('recipes.filters.upTo', { value: pendingFilters.maxKcal }) : '∞'}</span>
                </div>
                <input
                  type="range" min="100" max="1500" step="50"
                  value={pendingFilters.maxKcal || 1500}
                  onChange={e => setPendingFilters(prev => ({ ...prev, maxKcal: Number(e.target.value) === 1500 ? '' : Number(e.target.value) }))}
                  aria-label={t('recipes.filters.kcal')}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold mt-1">
                  <span>100 kcal</span><span>{t('recipes.filters.noLimit')}</span>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-blue-500">fitness_center</span>
                    {t('recipes.filters.protein')}
                  </span>
                  <span className="text-sm font-black text-primary">{pendingFilters.minProtein ? t('recipes.filters.atLeastGrams', { value: pendingFilters.minProtein }) : t('recipes.filters.any')}</span>
                </div>
                <input
                  type="range" min="0" max="100" step="5"
                  value={pendingFilters.minProtein || 0}
                  onChange={e => setPendingFilters(prev => ({ ...prev, minProtein: Number(e.target.value) === 0 ? '' : Number(e.target.value) }))}
                  aria-label={t('recipes.filters.protein')}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold mt-1">
                  <span>{t('recipes.filters.anyCapital')}</span><span>100 g</span>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-orange-400">grain</span>
                    {t('recipes.filters.carbs')}
                  </span>
                  <span className="text-sm font-black text-primary">{pendingFilters.maxCarbs ? t('recipes.filters.upToGrams', { value: pendingFilters.maxCarbs }) : '∞'}</span>
                </div>
                <input
                  type="range" min="0" max="200" step="10"
                  value={pendingFilters.maxCarbs || 200}
                  onChange={e => setPendingFilters(prev => ({ ...prev, maxCarbs: Number(e.target.value) === 200 ? '' : Number(e.target.value) }))}
                  aria-label={t('recipes.filters.carbs')}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold mt-1">
                  <span>0 g</span><span>{t('recipes.filters.noLimit')}</span>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-2xl p-4">
                <span className="font-bold text-sm text-on-surface flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px] text-green-500">timer</span>
                  {t('recipes.filters.prepTime')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {PREP_TIME_OPTIONS.map(val => (
                    <button
                      key={String(val)}
                      type="button"
                      aria-pressed={pendingFilters.maxPrepTime === val}
                      onClick={() =>
                        setPendingFilters(prev => ({
                          ...prev,
                          maxPrepTime: prev.maxPrepTime === val ? '' : val,
                        }))
                      }
                      className={`py-2.5 px-3.5 rounded-xl font-bold text-xs border-2 transition-all active:scale-95 whitespace-nowrap min-h-[40px] ${
                        pendingFilters.maxPrepTime === val
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant/20 bg-surface text-on-surface-variant'
                      }`}
                    >
                      {val === 'long' ? t('recipes.filters.prepTimeLong') : t('recipes.filters.prepTimeUpTo', { count: val })}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            </div>

            <div className="shrink-0 px-6 pt-3 pb-8 border-t border-outline-variant/15 bg-surface">
              <button
                type="button"
                onClick={applyFilters}
                className="w-full h-14 bg-primary text-on-primary font-black text-base rounded-2xl active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                {t('recipes.filters.apply')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

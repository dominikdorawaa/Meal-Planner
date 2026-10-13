import { useState, useMemo } from 'react';
import { BottomNav } from '../components/BottomNav';
import { useAppData } from '../lib/AppDataContext';
import { useNavigate } from 'react-router-dom';
import { RecipeCoverImage } from '../components/RecipeCoverImage';

type QuickPreset = 'quick' | 'highprotein' | 'lowcarb' | 'lowcal' | 'lowfat';

type PrepTimeFilter = number | '' | 'long';

interface Filters {
  maxKcal: number | '';
  minProtein: number | '';
  maxCarbs: number | '';
  maxPrepTime: PrepTimeFilter;
  /** Wiele presetów naraz — wszystkie muszą pasować (AND) */
  quick: QuickPreset[];
}

const DEFAULT_FILTERS: Filters = {
  maxKcal: '',
  minProtein: '',
  maxCarbs: '',
  maxPrepTime: '',
  quick: [],
};

const QUICK_FILTERS: { val: QuickPreset; label: string; hint: string; icon: string }[] = [
  { val: 'quick', label: 'Do 20 min', hint: 'Czas przygotowania do 20 minut', icon: 'bolt' },
  { val: 'highprotein', label: 'Dużo białka', hint: 'Co najmniej 25 g białka na porcję', icon: 'fitness_center' },
  { val: 'lowcarb', label: 'Mało węgli', hint: 'Maksymalnie 20 g węglowodanów', icon: 'grain' },
  { val: 'lowcal', label: 'Lekkie', hint: 'Do 400 kcal na porcję', icon: 'local_fire_department' },
  { val: 'lowfat', label: 'Niskotłuszczowe', hint: 'Maksymalnie 10 g tłuszczu', icon: 'water_drop' },
];

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

    // Wyszukiwanie
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

    // Filtry liczbowe
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

  // (stałe przeniesione na górę pliku)

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32">

      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10">
        <div className="flex items-center justify-between px-5 h-16 w-full max-w-2xl mx-auto">
          <h1 className="font-headline font-bold text-xl tracking-tight text-primary">Przepisy</h1>
          <button
            onClick={() => navigate('/add-recipe')}
            className="flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nowy
          </button>
        </div>
      </header>

      <main className="pt-20 px-5 max-w-2xl mx-auto">

        {/* Search & Filter bar */}
        <div className="flex gap-3 items-center py-4">
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant/50">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface-container-low rounded-2xl py-3 pl-12 pr-10 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-medium text-sm placeholder:text-on-surface-variant/40 transition-all"
              placeholder="Znajdź przepis..."
              type="text"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute inset-y-0 right-3 flex items-center text-on-surface-variant/50 active:scale-90">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <button
            onClick={openFilters}
            className={`relative p-3 rounded-2xl transition-all active:scale-95 ${activeFilterCount > 0 ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant'}`}
            title="Filtry przepisów"
          >
            <span className="material-symbols-outlined text-[22px]">tune</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-on-error text-[10px] font-black rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              {filtered.length} {filtered.length === 1 ? 'przepis' : 'przepisów'}
              {hasSearch && (
                <span className="font-medium normal-case tracking-normal text-on-surface-variant/80 block mt-1">
                  dla „{search.trim()}”
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
                Wyczyść
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary/50">Ładowanie...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-primary/30 text-4xl">menu_book</span>
            </div>
            <div>
              <p className="font-bold text-on-surface text-base">{search || activeFilterCount > 0 ? 'Brak wyników' : 'Brak przepisów'}</p>
              <p className="text-sm text-on-surface-variant mt-1">
                {search || activeFilterCount > 0 ? 'Zmień filtry lub wyszukiwaną frazę' : 'Dodaj swój pierwszy przepis!'}
              </p>
            </div>
            {!search && activeFilterCount === 0 && (
              <button
                onClick={() => navigate('/add-recipe')}
                className="mt-2 flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Dodaj przepis
              </button>
            )}
          </div>
        )}

        {/* Recipe Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-2 gap-4 pb-4">
            {filtered.map(recipe => (
              <div
                key={recipe.id}
                className="group cursor-pointer bg-surface-container-lowest rounded-3xl overflow-hidden shadow-sm border border-outline-variant/5 active:scale-[0.97] transition-all"
                onClick={() => navigate(`/recipe/${recipe.id}`)}
              >
                {/* Image */}
                <div className="aspect-[4/3] w-full bg-surface-container-low relative overflow-hidden">
                  <RecipeCoverImage
                    recipe={recipe}
                    alt={recipe.name}
                    className="absolute inset-0 w-full h-full"
                    imgClassName="w-full h-full object-cover group-active:scale-105 transition-transform duration-300"
                  />
                  {/* Kcal badge */}
                  <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1">
                    <span className="material-symbols-outlined text-[11px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                    <span className="text-[11px] font-black text-white">{recipe.kcal} kcal</span>
                  </div>
                  {/* Prep time badge */}
                  {recipe.prep_time && (
                    <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1">
                      <span className="material-symbols-outlined text-[11px] text-white/80">timer</span>
                      <span className="text-[11px] font-bold text-white/90">{recipe.prep_time}min</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 pb-3.5">
                  <h3 className="font-headline font-bold text-sm text-on-surface leading-snug mb-2 line-clamp-2">{recipe.name}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-full">B {recipe.protein}g</span>
                    <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-full">W {recipe.carbs}g</span>
                    <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-full">Tł {recipe.fat}g</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      {/* Filters Bottom Sheet */}
      {showFilters && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="w-full max-w-xl bg-surface rounded-t-[32px] animate-slide-up shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="overflow-y-auto flex-1 min-h-0 px-6 pt-6 pb-2">
              <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-5" />

              <div className="flex items-center justify-between mb-5">
                <h2 className="font-headline font-bold text-xl text-on-surface pr-2">Filtry</h2>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-bold text-primary active:scale-95 flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                  Resetuj
                </button>
              </div>

              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Szybkie filtry</p>
              <p className="text-[11px] text-on-surface-variant/85 leading-snug mt-1 mb-3">
                Możesz zaznaczyć kilka naraz — przepis musi spełniać wszystkie wybrane warunki. Zatwierdź na dole, żeby zamknąć panel.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {QUICK_FILTERS.map(qf => (
                  <button
                    key={qf.val}
                    type="button"
                    title={qf.hint}
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
                    {qf.label}
                  </button>
                ))}
              </div>

              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Wartości i czas</p>
              <p className="text-[11px] text-on-surface-variant/85 leading-snug mt-1 mb-3">
                Suwaki i czas — doprecyzuj, gdy gotowe presety to za mało.
              </p>
              <div className="space-y-3 mb-2">

              {/* Max Kcal */}
              <div className="bg-surface-container-low rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                    Kalorie
                  </span>
                  <span className="text-sm font-black text-primary">{pendingFilters.maxKcal ? `do ${pendingFilters.maxKcal}` : '∞'}</span>
                </div>
                <input
                  type="range" min="100" max="1500" step="50"
                  value={pendingFilters.maxKcal || 1500}
                  onChange={e => setPendingFilters(prev => ({ ...prev, maxKcal: Number(e.target.value) === 1500 ? '' : Number(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold mt-1">
                  <span>100 kcal</span><span>Bez limitu</span>
                </div>
              </div>

              {/* Min Białko */}
              <div className="bg-surface-container-low rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-blue-500">fitness_center</span>
                    Białko
                  </span>
                  <span className="text-sm font-black text-primary">{pendingFilters.minProtein ? `min ${pendingFilters.minProtein}g` : 'dowolne'}</span>
                </div>
                <input
                  type="range" min="0" max="100" step="5"
                  value={pendingFilters.minProtein || 0}
                  onChange={e => setPendingFilters(prev => ({ ...prev, minProtein: Number(e.target.value) === 0 ? '' : Number(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold mt-1">
                  <span>Dowolne</span><span>100g</span>
                </div>
              </div>

              {/* Max Węgle */}
              <div className="bg-surface-container-low rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-orange-400">grain</span>
                    Węgle
                  </span>
                  <span className="text-sm font-black text-primary">{pendingFilters.maxCarbs ? `do ${pendingFilters.maxCarbs}g` : '∞'}</span>
                </div>
                <input
                  type="range" min="0" max="200" step="10"
                  value={pendingFilters.maxCarbs || 200}
                  onChange={e => setPendingFilters(prev => ({ ...prev, maxCarbs: Number(e.target.value) === 200 ? '' : Number(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold mt-1">
                  <span>0g</span><span>Bez limitu</span>
                </div>
              </div>

              {/* Czas przygotowania – kafle */}
              <div className="bg-surface-container-low rounded-2xl p-4">
                <span className="font-bold text-sm text-on-surface flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px] text-green-500">timer</span>
                  Czas przygotowania
                </span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { label: 'do 15 min', val: 15 as PrepTimeFilter },
                      { label: 'do 30 min', val: 30 as PrepTimeFilter },
                      { label: 'do 45 min', val: 45 as PrepTimeFilter },
                      { label: 'do 60 min', val: 60 as PrepTimeFilter },
                      { label: '60 min i dłużej', val: 'long' as const },
                    ] satisfies { label: string; val: PrepTimeFilter }[]
                  ).map(opt => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      title={opt.val === 'long' ? 'Czas przygotowania co najmniej 60 minut' : `Maks. ${opt.val} min`}
                      onClick={() =>
                        setPendingFilters(prev => ({
                          ...prev,
                          maxPrepTime: prev.maxPrepTime === opt.val ? '' : opt.val,
                        }))
                      }
                      className={`py-2.5 px-3.5 rounded-xl font-bold text-xs border-2 transition-all active:scale-95 whitespace-nowrap min-h-[40px] ${
                        pendingFilters.maxPrepTime === opt.val
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant/20 bg-surface text-on-surface-variant'
                      }`}
                    >
                      {opt.label}
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
                Zastosuj i zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

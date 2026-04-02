import { BottomNav } from '../components/BottomNav';
import { useAppData } from '../lib/AppDataContext';
import { useNavigate } from 'react-router-dom';


export function Recipes() {
  const { recipes, loading } = useAppData();
  const navigate = useNavigate();

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 w-full max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <h1 className="font-headline font-bold text-xl tracking-tight text-primary">
              Przepisy
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="hover:bg-primary/10 transition-colors p-2 rounded-full active:scale-95 duration-200">
              <span className="material-symbols-outlined text-primary">search</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 px-6 max-w-2xl mx-auto">
        {/* Search & Filter */}
        <section className="mb-8 flex gap-3 items-center">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-on-surface-variant/60">search</span>
            </div>
            <input
              className="w-full bg-surface-container-low border-none rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant/50 text-on-surface font-medium transition-all"
              placeholder="Znajdź przepis..."
              type="text"
            />
          </div>
          <button className="bg-surface-container-highest p-3.5 rounded-xl hover:bg-surface-container-low transition-colors active:scale-95 duration-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">tune</span>
          </button>
        </section>

        {/* Category Pills */}
        <section className="flex gap-2 overflow-x-auto pb-4 no-scrollbar -mx-6 px-6 mb-4">
          <button className="bg-primary text-on-primary px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap">Wszystkie</button>
          <button className="bg-surface-container-highest text-on-surface-variant px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap hover:bg-surface-container-low transition-colors">Śniadanie</button>
          <button className="bg-surface-container-highest text-on-surface-variant px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap hover:bg-surface-container-low transition-colors">Low Carb</button>
          <button className="bg-surface-container-highest text-on-surface-variant px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap hover:bg-surface-container-low transition-colors">Szybkie</button>
        </section>

        {/* Recipe Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-8">
            {recipes.map(recipe => (
              <div
                key={recipe.id}
                className="group cursor-pointer"
                onClick={() => navigate(`/recipe/${recipe.id}`)}
              >
                <div className="aspect-square w-full rounded-3xl overflow-hidden mb-3 shadow-ambient bg-surface-container-low relative">
                  {recipe.image_url ? (
                    <img
                      className="w-full h-full object-cover transition-transform duration-500"
                      alt={recipe.name}
                      src={recipe.image_url}
                    />
                  ) : (
                    <div className="w-full h-full bg-[#f1f6ed] flex items-center justify-center">
                       <span className="material-symbols-outlined text-[#6B8E23] text-4xl opacity-50">photo_camera</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-surface/90 backdrop-blur-xl px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[10px] text-primary">local_fire_department</span>
                    <span className="text-[10px] font-bold text-primary tracking-wide leading-none">{recipe.kcal} kcal</span>
                  </div>
                </div>
                <div className="px-1">
                  <h3 className="font-headline font-bold text-on-surface leading-snug mb-1.5 line-clamp-2">{recipe.name}</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                      <span className="text-[10px] font-bold tracking-wider uppercase">{recipe.kcal} kcal</span>
                    </div>
                    <div className="flex items-center gap-1 text-on-surface-variant">
                      <span className="text-[10px] font-bold tracking-wider uppercase">{recipe.protein}g B.</span>
                    </div>
                    <div className="flex items-center gap-1 text-on-surface-variant">
                      <span className="text-[10px] font-bold tracking-wider uppercase">{recipe.fat}g Tł.</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      {/* FAB */}
      <button className="fixed bottom-28 right-6 bg-primary-gradient text-on-primary p-4 rounded-2xl shadow-ambient z-40 active:scale-95 duration-200">
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
}

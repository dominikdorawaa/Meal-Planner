import { Link, useLocation } from 'react-router-dom';

export function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav className="fixed bottom-0 w-full z-50 pointer-events-none">
      <div className="fixed bottom-6 left-6 right-6 rounded-full h-16 z-50 overflow-hidden flex justify-around items-center px-4 bg-white/90 backdrop-blur-2xl shadow-ambient pointer-events-auto border border-surface-container-highest/20">
        
        <Link 
          to="/"
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 active:scale-90 duration-300 ${path === '/' ? 'bg-primary/10 text-primary' : 'text-primary/50 hover:text-primary'}`}
        >
          <span className="material-symbols-outlined text-[20px] mb-0.5" style={path === '/' ? { fontVariationSettings: "'FILL' 1" } : {}}>calendar_month</span>
          <span className="font-body text-[8px] font-bold uppercase tracking-widest">Plan</span>
        </Link>

        <Link 
          to="/recipes"
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 active:scale-90 duration-300 ${path === '/recipes' ? 'bg-primary/10 text-primary' : 'text-primary/50 hover:text-primary'}`}
        >
          <span className="material-symbols-outlined text-[20px] mb-0.5" style={path === '/recipes' ? { fontVariationSettings: "'FILL' 1" } : {}}>restaurant_menu</span>
          <span className="font-body text-[8px] font-bold uppercase tracking-widest">Przepisy</span>
        </Link>
        
        <Link 
          to="/cart"
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 active:scale-90 duration-300 ${path === '/cart' ? 'bg-primary text-on-primary' : 'text-primary/50 hover:text-primary'}`}
        >
          <span className="material-symbols-outlined text-[20px] mb-0.5" style={path === '/cart' ? { fontVariationSettings: "'FILL' 1" } : {}}>list_alt</span>
          <span className="font-body text-[8px] font-bold uppercase tracking-widest">Zakupy</span>
        </Link>
        
        <Link 
          to="/profile"
          className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 active:scale-90 duration-300 ${path === '/profile' ? 'bg-primary/10 text-primary' : 'text-primary/50 hover:text-primary'}`}
        >
          <span className="material-symbols-outlined text-[20px] mb-0.5" style={path === '/profile' ? { fontVariationSettings: "'FILL' 1" } : {}}>more_horiz</span>
          <span className="font-body text-[8px] font-bold uppercase tracking-widest">Więcej</span>
        </Link>

      </div>
    </nav>
  );
}

import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        alert("Błąd rejestracji: " + error.message);
      } else {
        alert('Zarejestrowano pomyślnie! Użyj teraz tych samych danych roboczych, aby się zalogować (o ile wyłączyłeś "Confirm Email" w Supabase).');
        setIsRegistering(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert("Błąd logowania: " + error.message);
      } else {
        alert('Zalogowano pomyślnie!');
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-sm bg-surface-container-lowest p-8 rounded-[2rem] shadow-ambient">
        <div className="flex flex-col items-center mb-10">
          <span className="material-symbols-outlined text-primary text-5xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
          <h1 className="font-headline text-2xl font-bold text-on-surface tracking-tight">Meal Planner</h1>
          <p className="text-on-surface-variant mt-2 font-body text-sm">
            {isRegistering ? 'Załóż nowe konto' : 'Zaloguj się do swojego archiwum'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-on-surface-variant font-body text-xs font-semibold uppercase tracking-widest pl-4">Email</label>
            <input 
              type="email" 
              className="bg-surface-container-low border-none rounded-xl py-3.5 px-4 focus:ring-2 focus:ring-primary/20 text-on-surface outline-none transition-all placeholder:text-on-surface-variant/50 font-medium"
              placeholder="twój@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5 mb-2">
            <label className="text-on-surface-variant font-body text-xs font-semibold uppercase tracking-widest pl-4">Hasło</label>
            <input 
              type="password" 
              className="bg-surface-container-low border-none rounded-xl py-3.5 px-4 focus:ring-2 focus:ring-primary/20 text-on-surface outline-none transition-all placeholder:text-on-surface-variant/50 font-medium"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary-gradient text-on-primary font-headline font-semibold py-4 rounded-xl shadow-ambient active:scale-95 transition-all text-sm tracking-wide disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? 'Przetwarzanie...' : (isRegistering ? 'Stwórz profil' : 'Wejdź do aplikacji')}
            {!loading && <span className="material-symbols-outlined text-[18px]">{isRegistering ? 'person_add' : 'arrow_forward'}</span>}
          </button>
          
          <button 
            type="button" 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-on-surface-variant font-body text-xs mt-2 hover:text-primary transition-colors text-center w-full focus:outline-none"
          >
            {isRegistering ? 'Wróć do logowania' : 'Pierwszy raz? Załóż konto próbne'}
          </button>
        </form>
      </div>
    </div>
  );
}

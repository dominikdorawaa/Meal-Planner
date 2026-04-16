import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isRegistering) {
        await api.auth.register(email, password, name);
        // Powiadom App.tsx że sesja się zmieniła
        window.dispatchEvent(new Event('auth-change'));
        // Nowy użytkownik - od razu do onboardingu bez migania Plan
        navigate('/onboarding');
      } else {
        await api.auth.login(email, password);
        // Powiadom App.tsx że sesja się zmieniła
        window.dispatchEvent(new Event('auth-change'));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Wystąpił nieznany błąd');
    } finally {
      setLoading(false);
    }
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
          {isRegistering && (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <label className="text-on-surface-variant font-body text-xs font-semibold uppercase tracking-widest pl-4">Imię</label>
              <input
                type="text"
                className="bg-surface-container-low border-none rounded-xl py-3.5 px-4 focus:ring-2 focus:ring-primary/20 text-on-surface outline-none transition-all placeholder:text-on-surface-variant/50 font-medium"
                placeholder="Twoje imię"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
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

          {errorMsg && (
            <p className="text-red-400 text-xs text-center px-2">{errorMsg}</p>
          )}

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
            onClick={() => { setIsRegistering(!isRegistering); setErrorMsg(''); }}
            className="text-on-surface-variant font-body text-xs mt-2 hover:text-primary transition-colors text-center w-full focus:outline-none"
          >
            {isRegistering ? 'Wróć do logowania' : 'Pierwszy raz? Załóż konto próbne'}
          </button>
        </form>
      </div>
    </div>
  );
}

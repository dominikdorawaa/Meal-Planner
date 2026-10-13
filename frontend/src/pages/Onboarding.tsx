import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';

export function Onboarding() {
  const navigate = useNavigate();
  const { refreshProfile } = useAppData();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    gender: 'female',
    age: 30,
    weight: 65,
    height: 170,
    target_weight: 60,
    change_speed: 0.5,
    lifestyle_activity: 0,
    exercise_activity: 0
  });
  
  const [manualMode, setManualMode] = useState(false);
  const [manualMacros, setManualMacros] = useState({ kcal: 2000, protein: 150, fat: 70, carbs: 250 });
  
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    async function fetchExistingProfile() {
      const user = api.auth.getUser();
      if (!user) return;
      const record = await api.profile.get().catch(() => null);
      if (record) {
        setData(prev => ({
          gender: record.gender || prev.gender,
          age: record.age || prev.age,
          weight: record.weight || prev.weight,
          height: record.height || prev.height,
          target_weight: record.target_weight || record.weight || prev.target_weight,
          change_speed: record.change_speed || prev.change_speed,
          lifestyle_activity: record.lifestyle_activity || prev.lifestyle_activity,
          exercise_activity: record.exercise_activity || prev.exercise_activity
        }));
      }
    }
    fetchExistingProfile();
  }, []);

  const nextStep = () => setStep(prev => Math.min(prev + 1, 5));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const finish = async () => {
    try {
      setLoading(true);
      // Pobieranie aktualnie zalogowanego usera z naszego API
      const user = api.auth.getUser();
      
      if (!user) {
        alert("Wystąpił błąd: Sesja wygasła. Zaloguj się ponownie.");
        navigate('/login');
        return;
      }

      const m = manualMode 
        ? { 
            goal: 'manual',
            kcal: manualMacros.kcal, 
            protein: manualMacros.protein, proteinMin: manualMacros.protein, proteinMax: manualMacros.protein,
            fat: manualMacros.fat, fatMin: manualMacros.fat, fatMax: manualMacros.fat,
            carbs: manualMacros.carbs, carbsMin: manualMacros.carbs, carbsMax: manualMacros.carbs
          } 
        : calculateMacros();

      const { kcal, protein, fat, carbs } = m;
      // Rzut rekordu bezpośrednio pod dany ID do Supabase
      const result = await api.profile.update({
          id: user.userId,
          gender: data.gender || 'male',
          age: data.age || 30,
          weight: data.weight || 70,
          height: data.height || 170,
          target_weight: data.target_weight || data.weight || 70,
          change_speed: data.change_speed || 0.5,
          lifestyle_activity: data.lifestyle_activity || 0,
          exercise_activity: data.exercise_activity || 0,
          goal: manualMode ? 'manual' : m.goal,
          target_kcal: kcal,
          target_protein: protein,
          target_protein_min: m.proteinMin,
          target_protein_max: m.proteinMax,
          target_fat: fat,
          target_fat_min: m.fatMin,
          target_fat_max: m.fatMax,
          target_carbs: carbs,
          target_carbs_min: m.carbsMin,
          target_carbs_max: m.carbsMax
        }).catch((e) => ({ error: e }));

      if ((result as any).error) {
        throw (result as any).error;
      }
      
      // Sukces zapisu - wymuś odświeżenie danych w kontekście, zanim przejdziesz do Planu
      await refreshProfile();
      
      // Przekierowanie do ekranu planu
      navigate('/');
    } catch (error: any) {
      console.error('Supabase Error:', error.message);
      alert('Ups, wystąpił problem z zapisem profilu. Upewnij się, że masz podpiętą nową tabelę z utworzonego skryptu sql!');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (field: string, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const calculateMacros = () => {
    const w = parseFloat(data.weight as any) || 0;
    const h = parseFloat(data.height as any) || 0;
    const a = parseInt(data.age as any) || 0;
    const gender = data.gender;
    const lifestyle = parseFloat(data.lifestyle_activity as any) || 0;
    const exercise = parseFloat(data.exercise_activity as any) || 0;
    const pal = 1.2 + lifestyle + exercise;
    const speed = parseFloat(data.change_speed as any) || 0;

    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    bmr += gender === 'male' ? 5 : -161;

    let tdee = bmr * pal;

    const tWeight = parseFloat(data.target_weight as any) || w;
    const inferredGoal = w > tWeight ? 'reduce' : w < tWeight ? 'build' : 'maintain';

    let adjustment = (speed * 1000);

    if (inferredGoal === 'reduce') tdee -= adjustment;
    if (inferredGoal === 'build') tdee += adjustment;

    const kcal = Math.max(1200, Math.round(tdee));

    let protRange = [1.6, 2.0];
    let fatRange = [0.8, 1.2];
    let carbRange = [3.0, 5.0];

    if (inferredGoal === 'reduce') {
      protRange = [2.0, 2.4];
      fatRange = [0.8, 1.0];
      carbRange = [2.0, 4.0];
    } else if (inferredGoal === 'build') {
      protRange = [1.6, 2.0];
      fatRange = [1.0, 1.3];
      carbRange = [4.0, 7.0];
    }

    const protein = Math.round(w * ((protRange[0] + protRange[1]) / 2));
    const fat = Math.round(w * ((fatRange[0] + fatRange[1]) / 2));
    const carbs = Math.max(0, Math.round((kcal - (protein * 4) - (fat * 9)) / 4));

    return { 
      goal: inferredGoal,
      kcal, 
      protein, proteinMin: Math.round(w * protRange[0]), proteinMax: Math.round(w * protRange[1]),
      fat, fatMin: Math.round(w * fatRange[0]), fatMax: Math.round(w * fatRange[1]),
      carbs, carbsMin: Math.round(w * carbRange[0]), carbsMax: Math.round(w * carbRange[1])
    };
  };

  const m = calculateMacros();
  const { kcal } = m;

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen relative flex flex-col justify-between overflow-hidden">
      {/* Dynamiczne Tło */}
      <div className="absolute top-0 inset-x-0 h-64 bg-primary/5 rounded-b-[4rem] -z-10"></div>
      
      {/* Header & pasek postępu */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center justify-between mb-8">
          {step > 1 && step < 5 ? (
            <button onClick={prevStep} className="w-10 h-10 rounded-full bg-surface-container-highest/50 flex items-center justify-center text-primary hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          ) : <div className="w-10 h-10"></div>}
          
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'w-8 bg-primary' : 'w-4 bg-primary/20'}`}></div>
            ))}
          </div>
          
          <button onClick={finish} className="text-primary/50 text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors cursor-pointer active:scale-95">
            Pomiń
          </button>
        </div>

        {/* Ciało kwestionariusza */}
        {step === 1 && (
          <div className="opacity-100 transition-opacity duration-500">
            <h1 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Opowiedz nam o sobie</h1>
            <p className="text-on-surface-variant text-sm mb-6">Zaprojektujemy plan szyty idealnie na Twoją miarę.</p>
            
            <button 
              onClick={() => { setManualMode(true); setStep(6); }}
              className="w-full bg-surface-container-lowest p-4 rounded-2xl border border-primary/20 flex items-center justify-between mb-8 shadow-sm group hover:border-primary/50 transition-colors"
            >
              <div className="flex flex-col text-left">
                <span className="font-bold text-primary text-sm">Znasz już swoje makro?</span>
                <span className="text-xs text-on-surface-variant mt-0.5">Pomiń asystenta i wpisz wartości ręcznie</span>
              </div>
              <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>

            <div className="flex gap-4 mb-8">
              <button 
                onClick={() => handleUpdate('gender', 'female')}
                className={`flex-1 flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border-2 transition-all ${data.gender === 'female' ? 'border-primary bg-primary/5 text-primary' : 'border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:border-primary/30'}`}
              >
                <span className="material-symbols-outlined text-4xl">female</span>
                <span className="font-bold tracking-wide">Kobieta</span>
              </button>
              <button 
                onClick={() => handleUpdate('gender', 'male')}
                className={`flex-1 flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border-2 transition-all ${data.gender === 'male' ? 'border-primary bg-primary/5 text-primary' : 'border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:border-primary/30'}`}
              >
                <span className="material-symbols-outlined text-4xl">male</span>
                <span className="font-bold tracking-wide">Mężczyzna</span>
              </button>
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold tracking-wide text-on-surface">Ile masz lat?</span>
                <span className="text-primary font-headline font-bold text-2xl">{data.age}</span>
              </div>
              <input 
                type="range" min="16" max="100" 
                value={data.age} 
                onChange={(e) => handleUpdate('age', parseInt(e.target.value))}
                className="w-full accent-primary h-2 bg-surface-container-highest rounded-full appearance-none outline-none" 
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h1 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Twoje wymiary</h1>
            <p className="text-on-surface-variant text-sm mb-10">Są nam potrzebne do bardzo dokładnego oszacowania podstawowej przemiany materii (BMR).</p>
            
            <div className="flex flex-col gap-6">
              <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-surface-container-highest/20">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold tracking-wide text-on-surface">Wzrost (cm)</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-primary font-headline font-bold text-3xl">{data.height}</span>
                    <span className="text-primary/60 text-xs font-bold uppercase tracking-widest">cm</span>
                  </div>
                </div>
                <input 
                  type="range" min="140" max="220" 
                  value={data.height} 
                  onChange={(e) => handleUpdate('height', parseInt(e.target.value))}
                  className="w-full accent-primary h-2 bg-surface-container-highest rounded-full appearance-none outline-none" 
                />
              </div>

              <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-surface-container-highest/20">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold tracking-wide text-on-surface">Obecna waga (kg)</span>
                  <div className="flex items-baseline gap-1">
                    <input 
                      type="number" 
                      step="0.1"
                      value={data.weight} 
                      onChange={(e) => handleUpdate('weight', parseFloat(e.target.value) || 0)}
                      className="text-primary font-headline font-bold text-3xl bg-transparent w-24 text-right outline-none appearance-none"
                    />
                    <span className="text-primary/60 text-xs font-bold uppercase tracking-widest pl-1">kg</span>
                  </div>
                </div>
                <input 
                  type="range" min="40" max="150" step="0.1"
                  value={data.weight} 
                  onChange={(e) => handleUpdate('weight', parseFloat(e.target.value))}
                  className="w-full accent-primary h-2 bg-surface-container-highest rounded-full appearance-none outline-none" 
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h1 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Twój cel wagi</h1>
            <p className="text-on-surface-variant text-sm mb-8">Czy dążymy do zgubienia wagi, zrobienia masy, czy po prostu utrzymania?</p>
            
            <div className="flex flex-col gap-6">
              <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-surface-container-highest/20">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold tracking-wide text-on-surface">Masa docelowa (kg)</span>
                  <div className="flex items-baseline gap-1">
                    <input 
                      type="number" 
                      step="0.1"
                      value={data.target_weight} 
                      onChange={(e) => handleUpdate('target_weight', parseFloat(e.target.value) || 0)}
                      className="text-primary font-headline font-bold text-3xl bg-transparent w-24 text-right outline-none appearance-none"
                    />
                    <span className="text-primary/60 text-xs font-bold uppercase tracking-widest pl-1">kg</span>
                  </div>
                </div>
                <input 
                  type="range" min="40" max="150" step="0.1"
                  value={data.target_weight} 
                  onChange={(e) => handleUpdate('target_weight', parseFloat(e.target.value))}
                  className="w-full accent-primary h-2 bg-surface-container-highest rounded-full appearance-none outline-none" 
                />
              </div>

              <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-ambient border border-surface-container-highest/20 cursor-pointer">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold tracking-wide text-on-surface text-sm">Tempo zmiany (kg/tydzień)</span>
                  <div className="bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-xs">
                    {data.change_speed} kg
                  </div>
                </div>
                <input 
                  type="range" min="0.1" max="1.5" step="0.1"
                  value={data.change_speed} 
                  onChange={(e) => handleUpdate('change_speed', parseFloat(e.target.value))}
                  className="w-full accent-primary h-2 bg-surface-container-highest rounded-full appearance-none outline-none mb-2" 
                />
                <p className="text-[10px] text-on-surface-variant text-center opacity-80 mt-2">
                  * Zalecane bezbieczne tempo to 0.5 kg tygodniowo.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in">
            <h1 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Twój poziom aktywności</h1>
            <p className="text-on-surface-variant text-sm mb-6">Dokładne informacje pozwolą wyliczyć perfekcyjne dzienne spalanie (PAL).</p>
            
            <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-ambient border border-surface-container-highest/20 mb-4">
              <span className="block font-bold text-on-surface text-sm mb-4">Tryb życia (praca/szkoła)</span>
              <div className="space-y-2">
                {[
                  { val: 0, label: "Siedzący", desc: "Praca biurowa, mało ruchu" },
                  { val: 0.1, label: "Lekki", desc: "Dużo chodzenia, praca lekka" },
                  { val: 0.2, label: "Umiarkowany", desc: "Praca stojąca, aktywny dzień" },
                  { val: 0.3, label: "Aktywny", desc: "Ciężka praca fizyczna" }
                ].map((opt) => (
                  <button
                    key={'life_'+opt.val}
                    onClick={() => handleUpdate('lifestyle_activity', opt.val)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${data.lifestyle_activity === opt.val ? 'border-primary bg-primary/5 text-primary' : 'border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:border-primary/30'}`}
                  >
                    <div className="font-bold text-sm tracking-wide">{opt.label}</div>
                    <div className="text-[10px] mt-0.5 opacity-80">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-ambient border border-surface-container-highest/20">
              <span className="block font-bold text-on-surface text-sm mb-4">Aktywność treningowa</span>
              <div className="space-y-2">
                {[
                  { val: 0, label: "Brak", desc: "0 treningów tygodniowo" },
                  { val: 0.1, label: "Niska", desc: "1-2 treningi tygodniowo" },
                  { val: 0.2, label: "Średnia", desc: "3-4 treningi tygodniowo" },
                  { val: 0.3, label: "Wysoka", desc: "5+ treningów tygodniowo" }
                ].map((opt) => (
                  <button
                    key={'ex_'+opt.val}
                    onClick={() => handleUpdate('exercise_activity', opt.val)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${data.exercise_activity === opt.val ? 'border-primary bg-primary/5 text-primary' : 'border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:border-primary/30'}`}
                  >
                    <div className="font-bold text-sm tracking-wide">{opt.label}</div>
                    <div className="text-[10px] mt-0.5 opacity-80">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col items-center pt-2">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4 animate-pulse">
              <span className="material-symbols-outlined text-3xl">verified</span>
            </div>
            
            <h1 className="font-headline font-bold text-2xl text-primary tracking-tight text-center mb-1">
              Twój profil gotowy!
            </h1>
            <p className="text-on-surface-variant text-xs text-center mb-6 max-w-[280px]">
              Oto wyliczone przez nas dobowe zapotrzebowanie. Zapiszemy to jako Twój główny cel.
            </p>
            
            <div className="w-full bg-primary text-on-primary rounded-[2rem] p-6 shadow-ambient relative overflow-hidden mb-2">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
              
              <div className="flex flex-col items-center border-b border-white/20 pb-4 mb-4 relative z-10">
                <span className="text-white/80 font-bold uppercase tracking-widest text-[10px] mb-1">Cel dzienny</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-headline font-extrabold text-5xl tracking-tighter">{kcal}</span>
                  <span className="font-bold text-xs opacity-80">kcal</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 relative z-10">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1 leading-none text-center">Białka</span>
                  <span className="font-bold text-sm tracking-tighter whitespace-nowrap">{m.proteinMin}-{m.proteinMax} <span className="text-[9px] opacity-70">g</span></span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1 leading-none text-center">Tłuszcze</span>
                  <span className="font-bold text-sm tracking-tighter whitespace-nowrap">{m.fatMin}-{m.fatMax} <span className="text-[9px] opacity-70">g</span></span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1 leading-none text-center">Węgle</span>
                  <span className="font-bold text-sm tracking-tighter whitespace-nowrap">{m.carbsMin}-{m.carbsMax} <span className="text-[9px] opacity-70">g</span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col items-center pt-2 w-full animate-fade-in">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
              <span className="material-symbols-outlined text-3xl">tune</span>
            </div>
            
            <h1 className="font-headline font-bold text-2xl text-primary tracking-tight text-center mb-1">
              Ręczne Ustawienia
            </h1>
            <p className="text-on-surface-variant text-xs text-center mb-6 max-w-[280px]">
              Oto Twój całkowity, niezależny cel. Aplikacja oprze na nim paski postępu.
            </p>

            <div className="w-full grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2 bg-surface-container-lowest p-4 rounded-3xl shadow-ambient border border-outline-variant/10 text-center">
                <span className="text-xs font-bold uppercase tracking-widest text-primary block mb-2">Kcal</span>
                <input 
                  type="number"
                  value={manualMacros.kcal}
                  onChange={e => setManualMacros({...manualMacros, kcal: parseInt(e.target.value) || 0})}
                  className="w-full bg-transparent text-center font-headline font-extrabold text-4xl text-on-surface outline-none"
                />
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-3xl shadow-ambient border border-outline-variant/10 text-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Białka (g)</span>
                <input 
                  type="number"
                  value={manualMacros.protein}
                  onChange={e => setManualMacros({...manualMacros, protein: parseInt(e.target.value) || 0})}
                  className="w-full bg-transparent text-center font-bold text-xl text-primary outline-none"
                />
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-3xl shadow-ambient border border-outline-variant/10 text-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Tłuszcz (g)</span>
                <input 
                  type="number"
                  value={manualMacros.fat}
                  onChange={e => setManualMacros({...manualMacros, fat: parseInt(e.target.value) || 0})}
                  className="w-full bg-transparent text-center font-bold text-xl text-primary outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Zawsze na dole przyklejony footer z przyciskiem akcji */}
      <div className="p-6 pb-8 bg-surface/80 backdrop-blur-md sticky bottom-0 border-t border-surface-container-highest/20 mt-auto">
        {step < 5 ? (
          <button 
            onClick={nextStep}
            className="w-full bg-primary text-on-primary font-bold py-4 rounded-full shadow-lg hover:bg-primary/90 active:scale-95 transition-all text-sm tracking-wide"
          >
            Dalej
          </button>
        ) : (
          <button 
            onClick={finish}
            disabled={loading}
            className="w-full bg-primary text-on-primary font-bold py-4 flex items-center justify-center gap-2 rounded-full shadow-lg hover:bg-primary/90 active:scale-95 transition-all text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Zapisywanie profilu...' : (manualMode ? 'Zatwierdź własne makro' : 'Idź do Planu Posiłków')} {loading ? '' : <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
          </button>
        )}
      </div>
    </div>
  );
}

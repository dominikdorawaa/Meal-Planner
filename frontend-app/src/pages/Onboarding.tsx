import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    gender: 'female',
    age: 30,
    weight: 65,
    height: 170,
    activity: '1.55',
    goal: 'maintain'
  });
  
  const [manualMode, setManualMode] = useState(false);
  const [manualMacros, setManualMacros] = useState({ kcal: 2000, protein: 150, fat: 70, carbs: 250 });
  
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    async function fetchExistingProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: record } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
      if (record) {
        setData({
          gender: record.gender,
          age: record.age,
          weight: record.weight,
          height: record.height,
          activity: record.activity,
          goal: record.goal
        });
      }
    }
    fetchExistingProfile();
  }, []);

  const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const finish = async () => {
    try {
      setLoading(true);
      // Pobieranie aktualnie zalogowanego usera z JWT
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert("Wystąpił błąd: Sesja wygasła. Zaloguj się ponownie.");
        navigate('/login');
        return;
      }

      // Kalkulacja makro wyliczana dynamicznie zależnie od Trybu
      const m = manualMode 
        ? { 
            kcal: manualMacros.kcal, 
            protein: manualMacros.protein, proteinMin: manualMacros.protein, proteinMax: manualMacros.protein,
            fat: manualMacros.fat, fatMin: manualMacros.fat, fatMax: manualMacros.fat,
            carbs: manualMacros.carbs, carbsMin: manualMacros.carbs, carbsMax: manualMacros.carbs
          } 
        : calculateMacros();

      const { kcal, protein, fat, carbs } = m;
      // Rzut rekordu bezpośrednio pod dany ID do Supabase
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          gender: data.gender || 'male',
          age: data.age || 30,
          weight: data.weight || 70,
          height: data.height || 170,
          activity: data.activity || '1.55',
          goal: manualMode ? 'manual' : data.goal,
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
        });

      if (error) {
        throw error;
      }
      
      // Sukces zapisu - Przekierowanie do ekranu planu i wyjście z logiki kalkulatora
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
    let bmr = (10 * data.weight) + (6.25 * data.height) - (5 * data.age);
    bmr += data.gender === 'male' ? 5 : -161;
    
    let tdee = bmr * parseFloat(data.activity);
    
    if (data.goal === 'reduce') tdee -= 400;
    if (data.goal === 'build') tdee += 400;
    
    const kcal = Math.max(1200, Math.round(tdee));
    
    // Profesjonalne przeliczenie (g/kg)
    const weight = data.weight;
    const protein = Math.round(weight * 2.0);
    const proteinMin = Math.round(weight * 1.8);
    const proteinMax = Math.round(weight * 2.2);
    
    const fat = Math.round(weight * 0.9);
    const fatMin = Math.round(weight * 0.8);
    const fatMax = Math.round(weight * 1.0);
    
    const carbs = Math.round((kcal - (protein * 4) - (fat * 9)) / 4);
    const carbsMin = Math.round((kcal - (proteinMax * 4) - (fatMax * 9)) / 4);
    const carbsMax = Math.round((kcal - (proteinMin * 4) - (fatMin * 9)) / 4);
    
    return { 
      kcal, 
      protein, proteinMin, proteinMax,
      fat, fatMin, fatMax,
      carbs, carbsMin, carbsMax
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
          {step > 1 && step < 4 ? (
            <button onClick={prevStep} className="w-10 h-10 rounded-full bg-surface-container-highest/50 flex items-center justify-center text-primary hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          ) : <div className="w-10 h-10"></div>}
          
          <div className="flex gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'w-8 bg-primary' : 'w-4 bg-primary/20'}`}></div>
            ))}
          </div>
          
          <button onClick={() => navigate('/')} className="text-primary/50 text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors">
            Pomiń
          </button>
        </div>

        {/* Ciało kwestionariusza */}
        {step === 1 && (
          <div className="opacity-100 transition-opacity duration-500">
            <h1 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Opowiedz nam o sobie</h1>
            <p className="text-on-surface-variant text-sm mb-6">Zaprojektujemy plan szyty idealnie na Twoją miarę.</p>
            
            <button 
              onClick={() => { setManualMode(true); setStep(5); }}
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
            <h1 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">Twój główny cel</h1>
            <p className="text-on-surface-variant text-sm mb-8">Ustaw priorytety aplikacji dla idealnego jadłospisu.</p>
            
            <div className="flex flex-col gap-3 mb-8">
              {[
                { id: 'reduce', title: 'Redukcja wagi', icon: 'trending_down', desc: 'Chcę schudnąć, generując ujemny bilans ~400 kcal.' },
                { id: 'maintain', title: 'Utrzymanie wagi', icon: 'balance', desc: 'Czuję się świetnie. Chcę jeść idealnie tyle, ile spalam.' },
                { id: 'build', title: 'Budowa mięśni', icon: 'trending_up', desc: 'Chcę budować sylwetkę zachowując +400 kcal nadwyżki.' }
              ].map(goal => (
                <button 
                  key={goal.id}
                  onClick={() => handleUpdate('goal', goal.id)}
                  className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all text-left ${data.goal === goal.id ? 'border-primary bg-primary/5' : 'border-surface-container-highest bg-surface-container-lowest hover:border-primary/30'}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${data.goal === goal.id ? 'bg-primary text-on-primary' : 'bg-surface-container-highest/50 text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined">{goal.icon}</span>
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm ${data.goal === goal.id ? 'text-primary' : 'text-on-surface'}`}>{goal.title}</h3>
                    <p className="text-[10px] text-on-surface-variant mt-1 leading-snug">{goal.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-ambient border border-surface-container-highest/20 cursor-pointer">
              <label className="flex flex-col gap-2">
                <span className="font-bold tracking-wide text-sm text-on-surface">Poziom aktywności</span>
                <select 
                  className="w-full bg-surface-container-highest/20 text-on-surface px-4 py-3 rounded-xl outline-none border border-transparent focus:border-primary/50 text-sm font-medium transition-colors"
                  value={data.activity}
                  onChange={(e) => handleUpdate('activity', e.target.value)}
                >
                  <option value="1.2">Brak aktywności (siedzący tryb)</option>
                  <option value="1.375">Niska aktywność (1-2 treningi/tydz)</option>
                  <option value="1.55">Umiarkowana (3-4 treningi/tydz)</option>
                  <option value="1.725">Wysoka (5-6 treningów/tydz)</option>
                  <option value="1.9">Bardzo wysoka (zawodowiec)</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {step === 4 && (
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

        {step === 5 && (
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
        {step < 4 ? (
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

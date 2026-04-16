import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { BottomNav } from '../components/BottomNav';

const MEAL_TYPES = [
  { id: 'breakfast', name: 'Śniadanie', icon: 'light_mode' },
  { id: 'snack1', name: '2 Śniadanie', icon: 'bakery_dining' },
  { id: 'lunch', name: 'Lunch', icon: 'lunch_dining' },
  { id: 'snack2', name: 'Przekąska', icon: 'nutrition' },
  { id: 'dinner', name: 'Obiad', icon: 'restaurant' },
  { id: 'supper', name: 'Kolacja', icon: 'dark_mode' },
];

export function Profile() {
  const navigate = useNavigate();
  const [mealConfig, setMealConfig] = useState<any[]>([]);
  const [isEditingMeals, setIsEditingMeals] = useState<boolean>(false);
  const [isReordering, setIsReordering] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [isEditingMacros, setIsEditingMacros] = useState(false);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [kcalNotification, setKcalNotification] = useState<{ diff: number, show: boolean }>({ diff: 0, show: false });
  const [isInternalProfileEditing, setIsInternalProfileEditing] = useState(false);
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);
  const [isInternalGoalsEditing, setIsInternalGoalsEditing] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [tempProfile, setTempProfile] = useState<any>({
    display_name: '',
    gender: 'female',
    age: 30,
    weight: 65,
    target_weight: 60,
    height: 170,
    lifestyle_activity: 0,
    exercise_activity: 0,
    goal: 'reduce',
    change_speed: 0.5,
    is_manual_macros: false,
    target_kcal: 2000,
    target_protein: 120,
    target_fat: 60,
    target_carbs: 200,
    target_protein_min: 100,
    target_protein_max: 140,
    target_fat_min: 50,
    target_fat_max: 70,
    target_carbs_min: 180,
    target_carbs_max: 220
  });

  // Pomocnicze funkcje dla jednostek wzrostu
  const cmToFtIn = (cm: number) => {
    const totalInches = cm / 2.54;
    const ft = Math.floor(totalInches / 12);
    const inches = parseFloat((totalInches % 12).toFixed(1));
    return { ft, inches };
  };

  const ftInToCm = (ft: number, inches: number) => {
    return parseFloat(((ft * 30.48) + (inches * 2.54)).toFixed(1));
  };

  const { user, profile: cachedProfile, onLogout, refreshProfile } = useAppData();

  const displayGreetingName =
    (profile?.display_name || cachedProfile?.display_name || user?.name || '').trim() || null;

  // Inicjalizacja z cache'u kontekstu (natychmiastowa)
  useEffect(() => {
    if (cachedProfile && !profile) {
      const data = cachedProfile;
      setProfile(data);
      setTempProfile({
        display_name: data.display_name ?? '',
        gender: data.gender || 'female',
        age: data.age || 30,
        weight: data.weight || 65,
        target_weight: data.target_weight || data.weight || 65,
        height: data.height || 170,
        lifestyle_activity: data.lifestyle_activity || 0,
        exercise_activity: data.exercise_activity || 0,
        goal: data.goal || 'maintain',
        change_speed: data.change_speed || 0.5,
        is_manual_macros: data.is_manual_macros || false,
        target_kcal: data.target_kcal || 2000,
        target_protein: data.target_protein || 120,
        target_fat: data.target_fat || 60,
        target_carbs: data.target_carbs || 200,
        target_protein_min: data.target_protein_min || 100,
        target_protein_max: data.target_protein_max || 140,
        target_fat_min: data.target_fat_min || 50,
        target_fat_max: data.target_fat_max || 70,
        target_carbs_min: data.target_carbs_min || 180,
        target_carbs_max: data.target_carbs_max || 220
      });
      let mc = data.meal_config;
      if (typeof mc === 'string') {
        try { mc = JSON.parse(mc); } catch (e) { console.error("Error parsing meal_config", e); mc = null; }
      }
      let vm = data.visible_meals;
      if (typeof vm === 'string') {
        try { vm = JSON.parse(vm); } catch (e) { console.error("Error parsing visible_meals", e); vm = null; }
      }

      if (mc && Array.isArray(mc)) {
        setMealConfig(mc);
      } else {
        const defaultConfig = MEAL_TYPES.map(m => ({
          ...m,
          visible: Array.isArray(vm) ? vm.includes(m.id) : true
        }));
        setMealConfig(defaultConfig);
      }
    }
  }, [cachedProfile]);

  // Fallback: załaduj z DB jeśli cache nie ma danych
  useEffect(() => {
    if (profile) return; // już mamy z cache
    const loadProfile = async () => {
      const user = api.auth.getUser();
      if (!user) return;
      const data = await api.profile.get().catch(() => null);
      if (data) {
        setProfile(data);
        setTempProfile({
          display_name: data.display_name ?? '',
          gender: data.gender || 'female',
          age: data.age || 30,
          weight: data.weight || 65,
          target_weight: data.target_weight || data.weight || 65,
          height: data.height || 170,
          lifestyle_activity: data.lifestyle_activity || 0,
          exercise_activity: data.exercise_activity || 0,
          goal: data.goal || 'maintain',
          change_speed: data.change_speed || 0.5,
          is_manual_macros: data.is_manual_macros || false,
          target_kcal: data.target_kcal || 2000,
          target_protein: data.target_protein || 120,
          target_fat: data.target_fat || 60,
          target_carbs: data.target_carbs || 200,
          target_protein_min: data.target_protein_min || 100,
          target_protein_max: data.target_protein_max || 140,
          target_fat_min: data.target_fat_min || 50,
          target_fat_max: data.target_fat_max || 70,
          target_carbs_min: data.target_carbs_min || 180,
          target_carbs_max: data.target_carbs_max || 220
        });
        let mc = data.meal_config;
        if (typeof mc === 'string') {
          try { mc = JSON.parse(mc); } catch (e) { console.error("Error parsing meal_config", e); mc = null; }
        }
        let vm = data.visible_meals;
        if (typeof vm === 'string') {
          try { vm = JSON.parse(vm); } catch (e) { console.error("Error parsing visible_meals", e); vm = null; }
        }

        if (mc && Array.isArray(mc)) {
          setMealConfig(mc);
        } else {
          const defaultConfig = MEAL_TYPES.map(m => ({
            ...m,
            visible: Array.isArray(vm) ? vm.includes(m.id) : true
          }));
          setMealConfig(defaultConfig);
        }
      }
    };
    loadProfile();
  }, []);

  const handleMoveMeal = (index: number, direction: 'up' | 'down') => {
    const newConfig = [...mealConfig];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newConfig.length) return;

    [newConfig[index], newConfig[targetIdx]] = [newConfig[targetIdx], newConfig[index]];
    setMealConfig(newConfig);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const newConfig = [...mealConfig];
    const [item] = newConfig.splice(draggedIndex, 1);
    newConfig.splice(index, 0, item);
    setMealConfig(newConfig);
    setDraggedIndex(null);
  };

  const handleToggleVisibility = (id: string) => {
    setMealConfig(prev => prev.map(m => m.id === id ? { ...m, visible: !m.visible } : m));
  };

  const handleStartRename = (meal: any) => {
    setEditingMealId(meal.id);
    setTempName(meal.name);
  };

  const handleSaveRename = () => {
    if (editingMealId) {
      setMealConfig(prev => prev.map(m => m.id === editingMealId ? { ...m, name: tempName } : m));
      setEditingMealId(null);
    }
  };

  const handleSaveMealConfig = async () => {
    const finalConfig = editingMealId
      ? mealConfig.map(m => m.id === editingMealId ? { ...m, name: tempName } : m)
      : mealConfig;

    const user = api.auth.getUser();
    if (user) {
      const result = await api.profile.update({
        meal_config: finalConfig,
        visible_meals: finalConfig.filter(m => m.visible).map(m => m.id)
      }).catch((e) => ({ error: e }));

      if (!(result as any).error) {
        setMealConfig(finalConfig);
        setEditingMealId(null);
        setIsEditingMeals(false);
        setIsReordering(false);
      }
    }
  };

  const calculateMacros = (profileData: any) => {
    const weight = parseFloat(profileData.weight) || 0;
    const height = parseFloat(profileData.height) || 0;
    const age = parseInt(profileData.age) || 0;
    const gender = profileData.gender;
    const lifestyle = parseFloat(profileData.lifestyle_activity) || 0;
    const exercise = parseFloat(profileData.exercise_activity) || 0;
    const pal = 1.2 + lifestyle + exercise;
    const speed = parseFloat(profileData.change_speed) || 0;

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += gender === 'male' ? 5 : -161;

    const tdee_zero = bmr * pal;
    let tdee = tdee_zero;

    const targetWeight = parseFloat(profileData.target_weight) || weight;
    const inferredGoal = weight > targetWeight ? 'reduce'
      : weight < targetWeight ? 'build'
        : 'maintain';

    let adjustment = (speed * 1000);

    if (inferredGoal === 'reduce') tdee -= adjustment;
    if (inferredGoal === 'build') tdee += adjustment;

    const kcal = Math.max(1200, Math.round(tdee));

    // Zakresy g/kg na podstawie celu
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

    const protein = Math.round(weight * ((protRange[0] + protRange[1]) / 2));
    const fat = Math.round(weight * ((fatRange[0] + fatRange[1]) / 2));
    // Węglowodany to reszta kalorii
    const carbs = Math.max(0, Math.round((kcal - (protein * 4) - (fat * 9)) / 4));

    return {
      goal: inferredGoal,
      target_kcal: kcal,
      target_protein: protein,
      target_fat: fat,
      target_carbs: carbs,
      target_protein_min: Math.round(weight * protRange[0]),
      target_protein_max: Math.round(weight * protRange[1]),
      target_fat_min: Math.round(weight * fatRange[0]),
      target_fat_max: Math.round(weight * fatRange[1]),
      target_carbs_min: Math.round(weight * carbRange[0]),
      target_carbs_max: Math.round(weight * carbRange[1]),
      bmr: Math.round(bmr),
      pal: parseFloat(pal.toFixed(2)),
      tdee_zero: Math.round(tdee_zero),
      adjustment: Math.round(adjustment)
    };
  };

  const handleSaveProfileData = async () => {
    const user = api.auth.getUser();
    if (!user) return;

    let finalData = { ...tempProfile };

    if (!tempProfile.is_manual_macros) {
      const calculated = calculateMacros(tempProfile);
      finalData = { ...finalData, ...calculated };
    } else {
      const pct = getMacroPercentages(tempProfile, true);
      if (pct.total !== 100) {
        alert("Suma procentowa makroskładników musi wynosić dokładnie 100%!");
        return;
      }

      finalData = {
        ...finalData,
        target_kcal: parseFloat(finalData.target_kcal) || 0,
        target_protein: parseFloat(finalData.target_protein) || 0,
        target_fat: parseFloat(finalData.target_fat) || 0,
        target_carbs: parseFloat(finalData.target_carbs) || 0,
        target_protein_min: Math.floor(parseFloat(finalData.target_protein) * 0.95),
        target_protein_max: Math.ceil(parseFloat(finalData.target_protein) * 1.05),
        target_fat_min: Math.floor(parseFloat(finalData.target_fat) * 0.95),
        target_fat_max: Math.ceil(parseFloat(finalData.target_fat) * 1.05),
        target_carbs_min: Math.floor(parseFloat(finalData.target_carbs) * 0.95),
        target_carbs_max: Math.ceil(parseFloat(finalData.target_carbs) * 1.05),
      };
    }

    // Usunięcie pól pomocniczych, które nie istnieją w bazie danych
    const { bmr, pal, tdee_zero, adjustment, ...dbData } = finalData;

    const oldKcal = profile?.target_kcal || 0;
    const newKcal = dbData.target_kcal;
    const result = await api.profile.update(dbData).catch((e) => ({ error: e }));

    if (!(result as any).error) {
      if (tempProfile.is_manual_macros) {
        setKcalNotification({ diff: 0, show: true });
      } else {
        setKcalNotification({ diff: newKcal - oldKcal, show: true });
      }
      setTimeout(() => setKcalNotification(prev => ({ ...prev, show: false })), 4000);

      setProfile(dbData);
      setTempProfile(dbData);
      void refreshProfile();
      setIsEditingProfile(false);
      setIsEditingGoals(false);
      setIsEditingMacros(false);
    }
  };

  const confirmLogout = async () => {
    api.auth.logout();
    if (onLogout) onLogout();
    navigate('/login');
  };

  const getLifestyleLabel = (val: number | string) => {
    const options: Record<string, string> = {
      "0": "Siedzący",
      "0.1": "Lekki",
      "0.2": "Umiarkowany",
      "0.3": "Aktywny"
    };
    return options[String(val)] || "Ustaw tryb życia";
  };

  const getExerciseLabel = (val: number | string) => {
    const options: Record<string, string> = {
      "0": "Brak",
      "0.1": "Niska",
      "0.2": "Średnia",
      "0.3": "Wysoka",
      "0.4": "Bardzo wysoka"
    };
    return options[String(val)] || "Ustaw treningi";
  };

  const getGoalLabel = (val: string) => {
    const options: Record<string, string> = {
      "reduce": "Redukcja wagi",
      "maintain": "Utrzymanie obecnej wagi",
      "build": "Budowa masy mięśniowej"
    };
    return options[val] || val;
  };

  const getEstimatedTime = () => {
    const w1 = parseFloat(tempProfile.weight);
    const w2 = parseFloat(tempProfile.target_weight);
    const speed = parseFloat(tempProfile.change_speed);

    // Brak wymaganych danych
    if (!w1 || !w2 || isNaN(w1) || isNaN(w2)) return null;
    
    // Cel już osiągnięty lub brak prędkości
    if (w1 === w2) return "Cel osiągnięty!";
    if (!speed || isNaN(speed) || speed <= 0) return null;

    const diff = Math.abs(w1 - w2);
    const weeks = diff / speed;
    
    // Wynik nieprawidłowy (np. Infinity)
    if (!isFinite(weeks)) return null;

    const days = Math.ceil(weeks * 7);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const dateStr = targetDate.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const w = Math.ceil(weeks);
    return `${dateStr} (${w} tyg.)`;
  };

  const getMacroPercentages = (data: any, isManual: boolean = false) => {
    const kcal = parseFloat(data.target_kcal) || 0;
    if (kcal === 0) return { protein: 0, fat: 0, carbs: 0, total: 0 };

    const protein = Math.round((parseFloat(data.target_protein) * 4 / kcal) * 100);
    const fat = Math.round((parseFloat(data.target_fat) * 9 / kcal) * 100);

    if (!isManual) {
      return { protein, fat, carbs: 100 - protein - fat, total: 100 };
    }

    const carbs = Math.round((parseFloat(data.target_carbs) * 4 / kcal) * 100);
    return { protein, fat, carbs, total: protein + fat + carbs };
  };

  // Obliczanie makroskładników na żywo w zależności od trybu
  const currentMacros = tempProfile.is_manual_macros ? tempProfile : calculateMacros(tempProfile);
  const percentages = getMacroPercentages(currentMacros, tempProfile.is_manual_macros);

  const handleMacroChange = (key: 'protein' | 'fat' | 'carbs', type: 'gram' | 'percent', val: string) => {
    let newProfile = { ...tempProfile };
    const numVal = parseFloat(val) || 0;

    if (type === 'percent') {
      const kcal = parseFloat(tempProfile.target_kcal) || 0;
      const multi = key === 'fat' ? 9 : 4;
      const g = Math.round((kcal * numVal / 100) / multi);
      newProfile[`target_${key}`] = g;
    } else {
      newProfile[`target_${key}`] = numVal;
      
      // W trybie ręcznym zmiana gramów powinna aktualizować sumę kcal
      if (newProfile.is_manual_macros) {
        newProfile.target_kcal = 
          (parseFloat(newProfile.target_protein) || 0) * 4 + 
          (parseFloat(newProfile.target_fat) || 0) * 9 + 
          (parseFloat(newProfile.target_carbs) || 0) * 4;
      }
    }

    setTempProfile(newProfile);
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32">
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm h-16 flex items-center justify-center px-6">
        <h1 className="font-headline font-bold text-xl tracking-tight text-primary">Profil</h1>
      </header>

      {/* Powiadomienie o zmianie kcal */}
      <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[200] transition-all duration-500 transform ${kcalNotification.show ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0 pointer-events-none'}`}>
        <div className={`px-4 py-2 rounded-2xl shadow-xl border flex items-center gap-3 ${kcalNotification.diff === 0 ? 'bg-surface-container-highest border-outline-variant/20 text-on-surface' : (kcalNotification.diff > 0 ? 'bg-green-500 text-white border-green-400' : 'bg-amber-500 text-white border-amber-400')}`}>
          <span className="material-symbols-outlined text-[20px]">{kcalNotification.diff === 0 ? 'check_circle' : (kcalNotification.diff > 0 ? 'trending_up' : 'trending_down')}</span>
          <span className="text-sm font-bold whitespace-nowrap">
            {kcalNotification.diff === 0 ? 'Zapisano ustawienia' : `Twoje zapotrzebowanie: ${kcalNotification.diff > 0 ? '+' : ''}${kcalNotification.diff} kcal`}
          </span>
        </div>
      </div>

      <main className="pt-24 max-w-xl mx-auto px-6 flex flex-col gap-4">

        <div className="mb-6 flex flex-col items-center">
          <div className="w-24 h-24 bg-surface-container-highest/50 rounded-full flex items-center justify-center text-primary/50 mb-4 shadow-sm border-2 border-primary/10">
            <span className="material-symbols-outlined text-[40px]">person</span>
          </div>
          <h2 className="font-headline font-bold text-2xl text-on-surface">
            {displayGreetingName ? `Witaj, ${displayGreetingName}!` : 'Witaj!'}
          </h2>
          <p className="text-on-surface-variant text-sm">Zarządzaj swoimi danymi w Meal Plannerze</p>
        </div>

        {/* Dane Profilowe */}
        <button
          onClick={() => {
            setTempProfile({ ...profile });
            setIsInternalProfileEditing(false);
            setIsEditingProfile(true);
          }}
          className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl shadow-ambient flex items-center justify-between active:scale-95 transition-transform border border-outline-variant/10 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined">badge</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-on-surface text-[15px]">Dane Profilowe</span>
              <span className="text-xs text-on-surface-variant mt-0.5 font-medium">
                {profile?.display_name?.trim() || user?.name || 'Ustaw wyświetlaną nazwę'}
              </span>
              <span className="text-xs text-on-surface-variant mt-0.5">
                {profile?.gender === 'male' ? 'Mężczyzna' : 'Kobieta'}, {profile?.age} lat, {profile?.height} cm
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-primary/50">chevron_right</span>
        </button>

        {/* Cele i Masa */}
        <button
          onClick={() => {
            setTempProfile({ ...profile });
            setIsInternalGoalsEditing(false);
            setIsEditingGoals(true);
          }}
          className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl shadow-ambient flex items-center justify-between active:scale-95 transition-transform border border-outline-variant/10 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined">track_changes</span>
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <span className="font-bold text-on-surface text-[15px]">Cele i Masa</span>
                <div className="flex items-center gap-1 px-2 py-0.5 bg-primary/5 rounded-full border border-primary/10">
                  <span className="text-[10px] font-bold text-primary">{profile?.weight}</span>
                  <span className="material-symbols-outlined text-[10px] text-primary/40">arrow_forward</span>
                  <span className="text-[10px] font-bold text-primary">{profile?.target_weight || '--'}</span>
                  <span className="text-[9px] font-medium text-primary/60 ml-0.5">kg</span>
                </div>
              </div>
              <span className="text-xs text-on-surface-variant mt-0.5">Twoja waga, cel i tempo zmiany</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-primary/50">chevron_right</span>
        </button>

        {/* Twoje Makroskładniki */}
        <button
          onClick={() => setIsEditingMacros(true)}
          className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl shadow-ambient flex items-center justify-between active:scale-95 transition-transform border border-outline-variant/10 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined">nutrition</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-on-surface text-[15px]">Twoje Makroskładniki</span>
              <span className="text-xs text-on-surface-variant mt-0.5">{profile?.target_kcal || '---'}kcal, B {profile?.target_protein || '---'}g, T {profile?.target_fat || '---'}g, W {profile?.target_carbs || '---'}g</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-primary/50">chevron_right</span>
        </button>

        {/* Ustawienia Posiłków */}
        <button
          onClick={() => setIsEditingMeals(true)}
          className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl shadow-ambient flex items-center justify-between active:scale-95 transition-transform border border-outline-variant/10 group overflow-hidden relative"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined">restaurant_menu</span>
            </div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-on-surface text-[15px]">Ustawienia Posiłków</span>
              <span className="text-xs text-on-surface-variant mt-0.5">Zmień nazwy, kolejność i widoczność</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-primary/50">chevron_right</span>
        </button>

        <div className="mt-4 mb-8 px-0">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl bg-error/5 text-error text-[15px] font-bold border border-error/10 active:scale-[0.98] transition-all hover:bg-error/10"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Wyloguj się
          </button>
        </div>

      </main>
      <BottomNav />

      {/* Overlay Dane Profilowe */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-[100] bg-surface flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          <header className="flex items-center gap-4 p-6 border-b border-outline-variant/10">
            <button
              onClick={() => {
                setIsEditingProfile(false);
                setIsInternalProfileEditing(false);
              }}
              className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 className="font-headline font-bold text-2xl text-on-surface tracking-tight">Dane Profilowe</h2>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-32">
            {!isInternalProfileEditing ? (
              <div className="space-y-4">
                <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">badge</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] text-on-surface-variant font-bold uppercase">Wyświetlana nazwa</span>
                        <span className="font-bold text-lg truncate">
                          {profile?.display_name?.trim() || user?.name || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">{profile?.gender === 'male' ? 'male' : 'female'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-on-surface-variant font-bold uppercase">Płeć</span>
                        <span className="font-bold text-lg">{profile?.gender === 'male' ? 'Mężczyzna' : 'Kobieta'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">calendar_today</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-on-surface-variant font-bold uppercase">Wiek</span>
                        <span className="font-bold text-lg">{profile?.age} lat</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">height</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-on-surface-variant font-bold uppercase">Wzrost</span>
                        <span className="font-bold text-lg">{profile?.height} cm</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                   <p className="text-xs text-primary/70 italic text-center leading-relaxed">
                     To są Twoje podstawowe dane fizyczne używane do obliczeń.
                   </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/10">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase block mb-2">
                    Wyświetlana nazwa
                  </label>
                  <input
                    type="text"
                    value={tempProfile.display_name ?? ''}
                    onChange={e => setTempProfile({ ...tempProfile, display_name: e.target.value })}
                    placeholder={user?.name || 'Np. Ania'}
                    maxLength={80}
                    className="w-full bg-surface-container-highest/50 rounded-xl px-4 py-3 text-on-surface font-medium text-sm outline-none focus:ring-2 focus:ring-primary/20 border border-transparent"
                  />
                  <p className="text-[11px] text-on-surface-variant/80 mt-2 leading-relaxed">
                    Tak witamy Cię na ekranie profilu. Puste pole — używane jest imię z konta ({user?.name || 'brak'}).
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setTempProfile({ ...tempProfile, gender: 'female' })}
                    className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-3xl border-2 transition-all ${tempProfile.gender === 'female' ? 'border-primary bg-primary/5 text-primary' : 'border-surface-container-highest bg-surface-container-lowest text-on-surface-variant'}`}
                  >
                    <span className="material-symbols-outlined text-3xl">female</span>
                    <span className="font-bold text-xs uppercase tracking-widest">Kobieta</span>
                  </button>
                  <button
                    onClick={() => setTempProfile({ ...tempProfile, gender: 'male' })}
                    className={`flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-3xl border-2 transition-all ${tempProfile.gender === 'male' ? 'border-primary bg-primary/5 text-primary' : 'border-surface-container-highest bg-surface-container-lowest text-on-surface-variant'}`}
                  >
                    <span className="material-symbols-outlined text-3xl">male</span>
                    <span className="font-bold text-xs uppercase tracking-widest">Mężczyzna</span>
                  </button>
                </div>

                <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-on-surface text-sm">Wiek</span>
                    <div className="flex items-baseline gap-1">
                      <input
                        type="number"
                        min="1" max="100"
                        value={tempProfile.age}
                        onChange={(e) => setTempProfile({ ...tempProfile, age: Math.min(100, Math.max(1, parseInt(e.target.value) || 1)) })}
                        className="bg-transparent text-primary font-bold text-xl w-12 text-right outline-none"
                      />
                      <span className="text-primary/50 text-xs font-bold">lat</span>
                    </div>
                  </div>
                  <input
                    type="range" min="1" max="100"
                    value={tempProfile.age}
                    onChange={(e) => setTempProfile({ ...tempProfile, age: parseInt(e.target.value) })}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/10">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-on-surface text-sm">Wzrost</span>
                      <div className="flex bg-surface-container-highest/50 p-1 rounded-xl">
                        <button
                          onClick={() => setHeightUnit('cm')}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${heightUnit === 'cm' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}
                        >
                          CM
                        </button>
                        <button
                          onClick={() => setHeightUnit('ft')}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${heightUnit === 'ft' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}
                        >
                          FT/IN
                        </button>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      {heightUnit === 'cm' ? (
                        <>
                          <input
                            type="number"
                            value={tempProfile.height}
                            onChange={(e) => setTempProfile({ ...tempProfile, height: parseFloat(e.target.value) })}
                            className="bg-transparent text-primary font-bold text-xl w-16 text-right outline-none"
                          />
                          <span className="text-primary/50 text-xs font-bold">cm</span>
                        </>
                      ) : (
                        <div className="flex gap-2 text-primary font-bold text-xl">
                          <div className="flex items-baseline gap-0.5">
                            <span>{cmToFtIn(tempProfile.height).ft}</span>
                            <span className="text-[10px] opacity-50">ft</span>
                          </div>
                          <div className="flex items-baseline gap-0.5">
                            <span>{cmToFtIn(tempProfile.height).inches}</span>
                            <span className="text-[10px] opacity-50">in</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {heightUnit === 'cm' ? (
                    <input
                      type="range" min="140" max="230" step="0.5"
                      value={tempProfile.height}
                      onChange={(e) => setTempProfile({ ...tempProfile, height: parseFloat(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  ) : (
                    <div className="flex gap-4">
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[10px] text-on-surface-variant/50 font-bold uppercase text-center">Stopy</span>
                        <input
                          type="range" min="4" max="7" step="1"
                          value={cmToFtIn(tempProfile.height).ft}
                          onChange={(e) => {
                            const { inches } = cmToFtIn(tempProfile.height);
                            setTempProfile({ ...tempProfile, height: ftInToCm(parseInt(e.target.value), inches) });
                          }}
                          className="w-full accent-primary"
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[10px] text-on-surface-variant/50 font-bold uppercase text-center">Cale</span>
                        <input
                          type="range" min="0" max="11.5" step="0.5"
                          value={cmToFtIn(tempProfile.height).inches}
                          onChange={(e) => {
                            const { ft } = cmToFtIn(tempProfile.height);
                            setTempProfile({ ...tempProfile, height: ftInToCm(ft, parseFloat(e.target.value)) });
                          }}
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-surface via-surface to-transparent backdrop-blur-sm z-50 flex gap-3">
            {!isInternalProfileEditing ? (
              <button
                onClick={() => setIsInternalProfileEditing(true)}
                className="flex-1 bg-surface-container-highest text-on-surface py-4 rounded-2xl font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-outline-variant/10"
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
                Edytuj Dane
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsInternalProfileEditing(false);
                    setTempProfile({ ...profile });
                  }}
                  className="px-6 bg-surface-container-highest text-on-surface-variant py-4 rounded-2xl font-bold active:scale-[0.98] transition-all"
                >
                  Anuluj
                </button>
                <button
                  onClick={async () => {
                    await handleSaveProfileData();
                    setIsInternalProfileEditing(false);
                  }}
                  className="flex-1 bg-primary text-on-primary py-4 rounded-2xl font-bold shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">check</span>
                  Zapisz Zmiany
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay Cele i Masa */}
      {isEditingGoals && (
        <div className="fixed inset-0 z-[100] bg-surface flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          <header className="flex items-center gap-4 p-6 border-b border-outline-variant/10">
            <button
              onClick={() => {
                setIsEditingGoals(false);
                setIsInternalGoalsEditing(false);
              }}
              className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 className="font-headline font-bold text-2xl text-on-surface tracking-tight pr-4">Cele i Masa</h2>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-32">
            <div className="bg-surface-container-lowest p-6 rounded-[32px] border border-outline-variant/10 shadow-sm flex flex-col items-center gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-8 -mt-8"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">Przewidywany efekt</span>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-headline font-black text-on-surface">{isInternalGoalsEditing ? tempProfile.weight : profile?.weight}</span>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Obecna</span>
                </div>
                <div className="flex flex-col items-center gap-1 group">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-2xl">trending_flat</span>
                  </div>
                  <span className="text-[9px] font-black text-primary uppercase tracking-tighter w-max">
                    {getGoalLabel((isInternalGoalsEditing ? tempProfile.weight : profile?.weight) > (isInternalGoalsEditing ? tempProfile.target_weight : profile?.target_weight) ? 'reduce' : (isInternalGoalsEditing ? tempProfile.weight : profile?.weight) < (isInternalGoalsEditing ? tempProfile.target_weight : profile?.target_weight) ? 'build' : 'maintain')}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-headline font-black text-primary">{isInternalGoalsEditing ? tempProfile.target_weight : profile?.target_weight}</span>
                  <span className="text-[10px] font-bold text-primary/60 uppercase">Docelowa</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-outline-variant/10 w-full mt-2">
                {getEstimatedTime() && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary bg-primary/5 px-4 py-1.5 rounded-full">
                    <span className="material-symbols-outlined text-[16px]">timer</span>
                    <span>Cel osiągniesz: <span className="font-black uppercase">{getEstimatedTime()}</span></span>
                  </div>
                )}
              </div>
            </div>

            {!isInternalGoalsEditing ? (
              <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">monitor_weight</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase">Masa aktualna</span>
                      <span className="font-bold text-lg">{profile?.weight} kg</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">flag</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase">Masa docelowa</span>
                      <span className="font-bold text-lg">{profile?.target_weight} kg</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">speed</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase">Tempo zmiany</span>
                      <span className="font-bold text-lg">{profile?.change_speed} kg / tydz</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">directions_walk</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase">Tryb życia</span>
                      <span className="font-bold text-lg">{getLifestyleLabel(profile?.lifestyle_activity)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">fitness_center</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase">Treningi</span>
                      <span className="font-bold text-lg">{getExerciseLabel(profile?.exercise_activity)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">

            <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/10">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-on-surface text-sm">Masa aktualna (kg)</span>
                <span className="text-primary font-bold text-xl">{tempProfile.weight} kg</span>
              </div>
              <input
                type="range" min="40" max="150" step="0.5"
                value={tempProfile.weight}
                onChange={(e) => setTempProfile({ ...tempProfile, weight: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/10">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-on-surface text-sm">Masa docelowa (kg)</span>
                <span className="text-primary font-bold text-xl">{tempProfile.target_weight} kg</span>
              </div>
              <input
                type="range" min="40" max="150" step="0.5"
                value={tempProfile.target_weight}
                onChange={(e) => setTempProfile({ ...tempProfile, target_weight: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/10">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-on-surface text-sm">Tempo zmiany (kg/tydz)</span>
                <span className="text-primary font-bold text-xl">{tempProfile.change_speed} kg</span>
              </div>
              <input
                type="range" min="0.1" max="1.5" step="0.1"
                value={tempProfile.change_speed}
                onChange={(e) => setTempProfile({ ...tempProfile, change_speed: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/10">
              <span className="block font-bold text-on-surface text-sm mb-4">Tryb życia</span>
              <div className="space-y-2">
                {[
                  { val: 0, label: "Siedzący", desc: "Praca biurowa, mało ruchu" },
                  { val: 0.1, label: "Lekki", desc: "Dużo chodzenia, praca lekka" },
                  { val: 0.2, label: "Umiarkowany", desc: "Praca stojąca, aktywny dzień" },
                  { val: 0.3, label: "Aktywny", desc: "Ciężka praca fizyczna" }
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => setTempProfile({ ...tempProfile, lifestyle_activity: opt.val })}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${tempProfile.lifestyle_activity === opt.val ? 'border-primary bg-primary/5' : 'border-surface-container-highest bg-surface-container-lowest opacity-60'}`}
                  >
                    <div className="font-bold text-sm text-on-surface">{opt.label}</div>
                    <div className="text-[10px] text-on-surface-variant">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/10">
              <span className="block font-bold text-on-surface text-sm mb-4">Aktywność treningowa</span>
              <div className="space-y-2">
                {[
                  { val: 0, label: "Brak", desc: "0 treningów tygodniowo" },
                  { val: 0.1, label: "Niska", desc: "1-2 treningi tygodniowo" },
                  { val: 0.2, label: "Średnia", desc: "3-4 treningi tygodniowo" },
                  { val: 0.3, label: "Wysoka", desc: "5+ treningów tygodniowo" }
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => setTempProfile({ ...tempProfile, exercise_activity: opt.val })}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${tempProfile.exercise_activity === opt.val ? 'border-primary bg-primary/5' : 'border-surface-container-highest bg-surface-container-lowest opacity-60'}`}
                  >
                    <div className="font-bold text-sm text-on-surface">{opt.label}</div>
                    <div className="text-[10px] text-on-surface-variant">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          </div>

          <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-surface via-surface to-transparent backdrop-blur-sm z-50 flex gap-3">
            {!isInternalGoalsEditing ? (
              <button
                onClick={() => setIsInternalGoalsEditing(true)}
                className="flex-1 bg-surface-container-highest text-on-surface py-4 rounded-2xl font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-outline-variant/10"
              >
                <span className="material-symbols-outlined text-[20px]">edit</span>
                Edytuj Dane
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsInternalGoalsEditing(false);
                    setTempProfile({ ...profile });
                  }}
                  className="px-6 bg-surface-container-highest text-on-surface-variant py-4 rounded-2xl font-bold active:scale-[0.98] transition-all"
                >
                  Anuluj
                </button>
                <button
                  onClick={async () => {
                    await handleSaveProfileData();
                    setIsInternalGoalsEditing(false);
                  }}
                  className="flex-1 bg-primary text-on-primary py-4 rounded-2xl font-bold shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">check</span>
                  Zapisz Zmiany
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay Twoje Makroskładniki */}
      {isEditingMacros && (
        <div className="fixed inset-0 z-[100] bg-surface flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          <header className="flex items-center gap-4 p-6 border-b border-outline-variant/10">
            <button
              onClick={() => setIsEditingMacros(false)}
              className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 className="font-headline font-bold text-2xl text-on-surface tracking-tight pr-4">Twoje Makroskładniki</h2>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-32">
            <div className="bg-primary/5 rounded-[32px] p-6 border border-primary/10 flex flex-col items-center gap-2 relative group">
              <button 
                onClick={() => setShowFormulaInfo(true)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary active:scale-95 transition-transform"
                title="Zobacz wzór"
              >
                <span className="material-symbols-outlined text-[18px]">info</span>
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Twój cel kaloryczny</span>
              <div className="flex items-baseline gap-2">
                {tempProfile.is_manual_macros ? (
                  <input
                    type="number"
                    value={tempProfile.target_kcal}
                    onChange={(e) => setTempProfile({ ...tempProfile, target_kcal: e.target.value })}
                    className="bg-transparent text-4xl font-black text-primary text-center w-32 outline-none"
                  />
                ) : (
                  <span className="text-4xl font-black text-primary">{currentMacros.target_kcal}</span>
                )}
                <span className="text-lg font-bold text-primary/60">kcal</span>
              </div>
            </div>

            <div className={`p-5 rounded-[32px] border transition-all flex items-center justify-between ${!tempProfile.is_manual_macros ? 'bg-primary/10 border-primary/20' : 'bg-surface-container-highest/50 border-outline-variant/10'}`}>
              <div className="flex flex-col">
                <span className={`font-bold text-sm ${!tempProfile.is_manual_macros ? 'text-primary' : 'text-on-surface'}`}>Tryb automatyczny</span>
                <span className="text-[10px] text-on-surface-variant">System sam wyliczy idealne proporcje</span>
              </div>
              <button
                onClick={() => {
                  const nextIsManual = !tempProfile.is_manual_macros;
                  let updates: any = { is_manual_macros: nextIsManual };
                  
                  if (!nextIsManual) {
                    // Powrót do automatu - zsynchronizujmy tempProfile z wyliczeniami
                    const auto = calculateMacros(tempProfile);
                    updates = {
                      ...updates,
                      target_kcal: auto.target_kcal,
                      target_protein: auto.target_protein,
                      target_fat: auto.target_fat,
                      target_carbs: auto.target_carbs
                    };
                  }
                  
                  setTempProfile({ ...tempProfile, ...updates });
                }}
                className={`w-14 h-7 rounded-full p-1 transition-all duration-300 relative ${!tempProfile.is_manual_macros ? 'bg-primary' : 'bg-surface-container-highest'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 transform ${!tempProfile.is_manual_macros ? 'translate-x-7' : 'translate-x-0'}`}></div>
              </button>
            </div>

            <div className="space-y-4 pt-2">
              {[
                { label: 'Białko', key: 'protein', color: 'bg-primary' },
                { label: 'Tłuszcze', key: 'fat', color: 'bg-amber-500' },
                { label: 'Węglowodany', key: 'carbs', color: 'bg-blue-500' }
              ].map((m) => {
                const currentVal = (currentMacros as any)[`target_${m.key}`];
                const currentPct = (percentages as any)[m.key];

                return (
                  <div key={m.key} className="bg-surface-container-lowest p-5 rounded-[32px] border border-outline-variant/10 shadow-sm space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${m.color}`}></div>
                        <span className="font-bold text-on-surface text-sm uppercase tracking-wider">{m.label}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-on-surface">{(parseFloat(currentVal) / (parseFloat(tempProfile.weight) || 1)).toFixed(2)} g/kg</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1.2fr_1fr] gap-3 items-end">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase pl-1">Gramy (g)</span>
                        <div className={`w-full px-4 py-3 rounded-2xl font-black text-lg transition-all flex items-center justify-center ${tempProfile.is_manual_macros ? 'bg-primary/5 text-primary border border-primary/20' : 'bg-surface-container-highest/50 text-on-surface-variant opacity-50'}`}>
                          {tempProfile.is_manual_macros ? (
                            <input
                              type="number"
                              value={currentVal}
                              onChange={(e) => handleMacroChange(m.key as any, 'gram', e.target.value)}
                              className="bg-transparent text-center w-full outline-none"
                            />
                          ) : (
                            <span className="text-[15px] whitespace-nowrap">{(calculateMacros(tempProfile) as any)[`target_${m.key}_min`]} - {(calculateMacros(tempProfile) as any)[`target_${m.key}_max`]}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase pl-1">Udział (%)</span>
                        <div className={`w-full px-4 py-3 rounded-2xl font-black text-lg transition-all flex items-center justify-center ${tempProfile.is_manual_macros ? 'bg-primary/5 text-primary border border-primary/20' : 'bg-surface-container-highest/50 text-on-surface-variant opacity-50'}`}>
                          {tempProfile.is_manual_macros ? (
                            <input
                              type="number"
                              value={currentPct}
                              onChange={(e) => handleMacroChange(m.key as any, 'percent', e.target.value)}
                              className="bg-transparent text-center w-full outline-none"
                            />
                          ) : (
                            <span className="text-[13px] whitespace-nowrap">
                              {Math.round(((calculateMacros(tempProfile) as any)[`target_${m.key}_min`] * (m.key === 'fat' ? 9 : 4) / (calculateMacros(tempProfile).target_kcal || 1)) * 100)}% - {Math.round(((calculateMacros(tempProfile) as any)[`target_${m.key}_max`] * (m.key === 'fat' ? 9 : 4) / (calculateMacros(tempProfile).target_kcal || 1)) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={`p-4 rounded-[32px] border transition-all flex items-center justify-between ${percentages.total === 100 ? 'bg-green-500/5 border-green-500/20 text-green-600' : 'bg-error/5 border-error/20 text-error'}`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">balance</span>
                <span className="text-[11px] font-bold uppercase tracking-widest">Suma (%)</span>
              </div>
              <span className="text-xl font-black">{percentages.total}% / 100%</span>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-surface via-surface to-transparent backdrop-blur-sm z-50">
            <button
              onClick={handleSaveProfileData}
              disabled={tempProfile.is_manual_macros && percentages.total !== 100}
              className={`w-full py-4 rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${tempProfile.is_manual_macros && percentages.total !== 100 ? 'bg-surface-container-highest text-on-surface-variant/30 shadow-none' : 'bg-primary text-on-primary shadow-primary/30'}`}
            >
              <span className="material-symbols-outlined text-[20px]">check</span>
              Zapisz Makroskładniki
            </button>
          </div>
        </div>
      )}

      {/* Overlay do konfiguracji posiłków */}
      {isEditingMeals && (
        <div className="fixed inset-0 z-[100] bg-surface flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          <header className="flex items-center gap-4 p-6 border-b border-outline-variant/10">
            <button
              onClick={() => { setIsEditingMeals(false); setIsReordering(false); }}
              className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 className="font-headline font-bold text-2xl text-on-surface tracking-tight">Ustawienia Posiłków</h2>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar pb-32">
            <div className="flex items-center justify-between mb-2">
              <p className="text-on-surface-variant text-sm italic leading-relaxed opacity-80">
                {isReordering ? "Przeciągnij posiłek, aby zmienić jego pozycję." : "Dostosuj nazwy i wybierz aktywne posiłki."}
              </p>
              <button
                onClick={() => setIsReordering(!isReordering)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${isReordering ? 'bg-primary text-on-primary' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
              >
                <span className="material-symbols-outlined text-[16px]">{isReordering ? 'check' : 'reorder'}</span>
                {isReordering ? 'Gotowe' : 'Zmień kolejność'}
              </button>
            </div>

            {mealConfig.map((meal, index) => (
              <div
                key={meal.id}
                draggable={isReordering}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index)}
                className={`p-4 rounded-3xl border border-outline-variant/10 shadow-sm flex flex-col gap-3 transition-all duration-200 ${isReordering ? 'cursor-grab active:cursor-grabbing hover:bg-primary/[0.03] border-dashed bg-surface/50' : 'bg-surface-container-lowest'} ${draggedIndex === index ? 'opacity-30 scale-95 border-primary bg-primary/5' : 'opacity-100'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-sm border border-primary/5">
                      {isReordering ? (
                        <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">{meal.icon}</span>
                      )}
                    </div>

                    {editingMealId === meal.id && !isReordering ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onBlur={handleSaveRename}
                          className="bg-surface-container-highest border-none rounded-xl px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-primary/20 w-36 shadow-inner"
                          autoFocus
                        />
                        <button onClick={handleSaveRename} className="w-8 h-8 bg-primary/20 text-primary rounded-lg flex items-center justify-center active:scale-90 transition-transform">
                          <span className="material-symbols-outlined text-[20px]">check</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-on-surface text-[15px]">{meal.name}</span>
                        {!isReordering && (
                          <button onClick={() => handleStartRename(meal)} className="w-7 h-7 flex items-center justify-center text-on-surface-variant/40 hover:text-primary active:scale-90 transition-colors">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    disabled={isReordering}
                    onClick={() => handleToggleVisibility(meal.id)}
                    className={`w-11 h-6 rounded-full p-1 transition-all duration-300 relative shadow-inner ${meal.visible ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/30'} ${isReordering ? 'opacity-30' : ''}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 transform ${meal.visible ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </button>
                </div>

                {!isReordering && (
                  <div className="flex items-center justify-end gap-2 border-t border-outline-variant/5 pt-2">
                    <button
                      onClick={() => handleMoveMeal(index, 'up')}
                      disabled={index === 0}
                      className="w-9 h-9 rounded-xl bg-surface-container-highest/50 flex items-center justify-center text-on-surface-variant disabled:opacity-20 active:scale-90 transition-all hover:bg-primary/5"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                    </button>
                    <button
                      onClick={() => handleMoveMeal(index, 'down')}
                      disabled={index === mealConfig.length - 1}
                      className="w-9 h-9 rounded-xl bg-surface-container-highest/50 flex items-center justify-center text-on-surface-variant disabled:opacity-20 active:scale-90 transition-all hover:bg-primary/5"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-surface via-surface to-transparent backdrop-blur-sm z-50">
            <button
              onClick={handleSaveMealConfig}
              className="w-full bg-primary text-on-primary py-4 rounded-2xl font-bold shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:brightness-105"
            >
              <span className="material-symbols-outlined text-[20px]">save</span>
              Zastosuj i Zapisz
            </button>
          </div>
        </div>
      )}

      {/* Overlay z informacją o wzorze */}
      {showFormulaInfo && (() => {
        const results = calculateMacros(tempProfile);
        const bmr = results.bmr;
        const pal = results.pal;
        const tdee = Math.round(results.tdee_zero);
        const goalAdj = Math.round(results.adjustment);
        const finalKcal = results.target_kcal;

        return (
          <div className="fixed inset-0 z-[200] bg-surface flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
            <header className="flex items-center gap-4 p-6 border-b border-outline-variant/10">
              <button
                onClick={() => setShowFormulaInfo(false)}
                className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <h2 className="font-headline font-bold text-xl text-on-surface tracking-tight">Wzór Obliczeń</h2>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
              <section className="space-y-4 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-2 border border-primary/5">
                  <span className="material-symbols-outlined text-[40px]">bolt</span>
                </div>
                <h3 className="font-headline font-black text-2xl text-on-surface">Jak to liczmy?</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed px-4">
                  Twoje zapotrzebowanie to suma trzech prostych kroków: Bazy, Twojego Ruchu i wybranego Celu.
                </p>
              </section>

              {/* KROK 1 */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center font-black text-sm">1</div>
                  <h3 className="text-on-surface font-black text-sm uppercase tracking-widest">Krok 1: Twoja Baza (PPM)</h3>
                </div>
                <div className="bg-surface-container-lowest p-6 rounded-[32px] border border-outline-variant/10 shadow-sm space-y-4">
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Energia, której Twój organizm potrzebuje do przeżycia w stanie całkowitego spoczynku.
                  </p>
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-primary/60 uppercase">Twoje wyliczenie:</span>
                        <span className="text-primary font-black">{Math.round(bmr)} kcal</span>
                     </div>
                     <p className="text-[9px] text-primary/40 italic leading-tight">
                       (10 × {tempProfile.weight}kg) + (6.25 × {tempProfile.height}cm) - (5 × {tempProfile.age}lat) {tempProfile.gender === 'male' ? '+ 5' : '- 161'}
                     </p>
                  </div>
                </div>
              </section>

              {/* KROK 2 */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center font-black text-sm">2</div>
                  <h3 className="text-on-surface font-black text-sm uppercase tracking-widest">Krok 2: Twój Ruch (PAL)</h3>
                </div>
                <div className="bg-surface-container-lowest p-6 rounded-[32px] border border-outline-variant/10 shadow-sm space-y-4">
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Teraz mnożymy "Bazę" przez Twoją codzienną aktywność. Im więcej się ruszasz, tym więcej spalasz.
                  </p>
                  <div className="space-y-2">
                     <div className="flex justify-between items-center bg-surface-container-highest/30 p-3 rounded-xl border border-outline-variant/5">
                        <span className="text-xs text-on-surface-variant">Podstawa życia</span>
                        <span className="font-bold text-on-surface">1.20</span>
                     </div>
                     <button 
                       onClick={() => {
                          setShowFormulaInfo(false);
                          setIsEditingMacros(false);
                          setIsEditingGoals(true);
                       }}
                       className="w-full flex justify-between items-center bg-primary/5 p-4 rounded-2xl border border-primary/10 active:scale-[0.98] transition-all hover:bg-primary/10 group relative overflow-hidden"
                     >
                        <div className="absolute left-0 top-0 w-1 h-full bg-primary opacity-20"></div>
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="text-[9px] text-primary/60 uppercase font-black tracking-widest">Twoja aktywność:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-on-surface group-hover:text-primary transition-colors">{getLifestyleLabel(tempProfile.lifestyle_activity)}</span>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Zmień</span>
                          </div>
                        </div>
                        <span className="font-black text-lg text-primary">+ {tempProfile.lifestyle_activity.toFixed(2)}</span>
                     </button>

                     <button 
                       onClick={() => {
                          setShowFormulaInfo(false);
                          setIsEditingMacros(false);
                          setIsEditingGoals(true);
                       }}
                       className="w-full flex justify-between items-center bg-primary/5 p-4 rounded-2xl border border-primary/10 active:scale-[0.98] transition-all hover:bg-primary/10 group relative overflow-hidden"
                     >
                        <div className="absolute left-0 top-0 w-1 h-full bg-primary opacity-20"></div>
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="text-[9px] text-primary/60 uppercase font-black tracking-widest">Twoje treningi:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-on-surface group-hover:text-primary transition-colors">{getExerciseLabel(tempProfile.exercise_activity)}</span>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Zmień</span>
                          </div>
                        </div>
                        <span className="font-black text-lg text-primary">+ {tempProfile.exercise_activity.toFixed(2)}</span>
                     </button>
                  </div>
                  <div className="p-4 bg-primary text-on-primary rounded-2xl flex justify-between items-center shadow-lg shadow-primary/20">
                      <span className="text-xs font-bold uppercase">Twój całkowity ruch</span>
                      <span className="text-xl font-black">× {pal.toFixed(2)}</span>
                  </div>
                  <p className="text-center text-[10px] font-bold text-on-surface mt-2 text-balance leading-relaxed uppercase tracking-tighter opacity-70">
                    Twoje "Zero Kaloryczne" (Utrzymanie): <span className="text-primary font-black tracking-normal">{tdee} kcal</span>
                  </p>
                </div>
              </section>

              {/* KROK 3 */}
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center font-black text-sm">3</div>
                  <h3 className="text-on-surface font-black text-sm uppercase tracking-widest">Krok 3: Twój Cel</h3>
                </div>
                <div className="bg-surface-container-lowest p-6 rounded-[32px] border border-outline-variant/10 shadow-sm space-y-4">
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    To ostatni szlif. Odejmujemy (jeśli chudniesz) lub dodajemy (jeśli budujesz masę) kalorie od Twojego "Zera".
                  </p>
                  
                  <div className="space-y-2">
                    <button 
                      onClick={() => {
                          setShowFormulaInfo(false);
                          setIsEditingMacros(false);
                          setIsEditingGoals(true);
                      }}
                      className="w-full flex justify-between items-center bg-primary/5 p-4 rounded-2xl border border-primary/10 active:scale-[0.98] transition-all hover:bg-primary/10 group relative overflow-hidden text-left"
                    >
                      <div className="absolute left-0 top-0 w-1 h-full bg-primary opacity-20"></div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-primary/60 uppercase font-black tracking-widest">Twój Cel:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-on-surface group-hover:text-primary transition-colors">
                            {Number(tempProfile.weight) > Number(tempProfile.target_weight) 
                              ? 'Redukcja (Odchudzanie)' 
                              : Number(tempProfile.weight) < Number(tempProfile.target_weight) 
                                ? 'Masa (Budowanie)' 
                                : 'Utrzymanie wagi'}
                          </span>
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Zmień</span>
                        </div>
                      </div>
                      <span className={`material-symbols-outlined text-xl ${Number(tempProfile.weight) > Number(tempProfile.target_weight) ? 'text-error' : Number(tempProfile.weight) < Number(tempProfile.target_weight) ? 'text-success' : 'text-primary'}`}>
                        {Number(tempProfile.weight) > Number(tempProfile.target_weight) ? 'trending_down' : Number(tempProfile.weight) < Number(tempProfile.target_weight) ? 'trending_up' : 'horizontal_rule'}
                      </span>
                    </button>

                    <button 
                      onClick={() => {
                          setShowFormulaInfo(false);
                          setIsEditingMacros(false);
                          setIsEditingGoals(true);
                      }}
                      className="w-full flex justify-between items-center bg-primary/5 p-4 rounded-2xl border border-primary/10 active:scale-[0.98] transition-all hover:bg-primary/10 group relative overflow-hidden text-left"
                    >
                      <div className="absolute left-0 top-0 w-1 h-full bg-primary opacity-20"></div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-primary/60 uppercase font-black tracking-widest">Tempo zmiany:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-on-surface group-hover:text-primary transition-colors">{tempProfile.change_speed} kg / tydzień</span>
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Zmień</span>
                        </div>
                      </div>
                    </button>
                  </div>

                  <p className="text-center text-[10px] font-bold text-on-surface mt-2 text-balance leading-relaxed uppercase tracking-tighter opacity-70">
                    Korekta celu: <span className={Number(tempProfile.weight) > Number(tempProfile.target_weight) ? 'text-error' : 'text-primary'}>
                      {Number(tempProfile.weight) > Number(tempProfile.target_weight) ? `-${goalAdj}` : Number(tempProfile.weight) < Number(tempProfile.target_weight) ? `+${goalAdj}` : '0'} kcal
                    </span>
                  </p>
                </div>
              </section>

              <div className="p-6 bg-primary text-on-primary rounded-[32px] shadow-2xl shadow-primary/30 flex flex-col items-center gap-2">
                   <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Twój Wynik Końcowy</span>
                   <span className="text-4xl font-headline font-black">{finalKcal}</span>
                   <span className="text-sm font-bold opacity-80">kcal dziennie</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Potwierdzenie wylogowania */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-surface/40" onClick={() => setShowLogoutConfirm(false)}></div>
          <div className="bg-surface border border-outline-variant/10 p-8 rounded-[32px] shadow-2xl w-full max-w-xs relative animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center text-error mb-4">
              <span className="material-symbols-outlined text-[32px]">logout</span>
            </div>
            <h3 className="font-headline font-bold text-xl text-on-surface mb-2">Wylogować się?</h3>
            <p className="text-on-surface-variant text-sm mb-8">Czy na pewno chcesz opuścić swoje konto?</p>
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={confirmLogout}
                className="w-full bg-error text-on-error py-4 rounded-2xl font-bold active:scale-[0.98] transition-all shadow-lg shadow-error/20"
              >
                Tak, wyloguj
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full bg-surface-container-highest text-on-surface-variant py-4 rounded-2xl font-bold active:scale-[0.98] transition-all"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

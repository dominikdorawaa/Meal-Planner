import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { type AuthUser, api } from './apiClient';
import { resolveMealProduct } from './mealProducts';

interface AppData {
  user: AuthUser | null;
  profile: any;
  recipes: any[];
  userMeals: any[];
  shoppingList: any[];
  shoppingListRecipes: any[];
  loading: boolean;
  onLogout: () => void;
  refreshProfile: () => Promise<void>;
  saveProfile: (changes: Record<string, unknown>) => Promise<unknown>;
  refreshRecipes: () => Promise<void>;
  refreshMeals: () => Promise<void>;
  refreshShoppingList: () => Promise<void>;
  getConsumedForDay: (date: string) => { kcal: number, protein: number, fat: number, carbs: number };
  setUserMeals: React.Dispatch<React.SetStateAction<any[]>>;
  setShoppingList: React.Dispatch<React.SetStateAction<any[]>>;
}

const AppDataContext = createContext<AppData>({
  user: null,
  profile: null,
  recipes: [],
  userMeals: [],
  shoppingList: [],
  shoppingListRecipes: [],
  loading: true,
  onLogout: () => {},
  refreshProfile: async () => {},
  saveProfile: async () => null,
  refreshRecipes: async () => {},
  refreshMeals: async () => {},
  refreshShoppingList: async () => {},
  getConsumedForDay: () => ({ kcal: 0, protein: 0, fat: 0, carbs: 0 }),
  setUserMeals: () => {},
  setShoppingList: () => {},
});

function parseProfileJSON(data: any) {
  if (!data) return data;
  const newData = { ...data };
  if (typeof newData.meal_config === 'string') {
    try { newData.meal_config = JSON.parse(newData.meal_config); } catch (e) { console.error("Error parsing meal_config", e); }
  }
  if (typeof newData.visible_meals === 'string') {
    try { newData.visible_meals = JSON.parse(newData.visible_meals); } catch (e) { console.error("Error parsing visible_meals", e); }
  }
  return newData;
}

interface AppDataProviderProps {
  children: React.ReactNode;
  user: AuthUser | null;
  onLogout: () => void;
}

export function AppDataProvider({ children, user, onLogout }: AppDataProviderProps) {
  const [profile, setProfile] = useState<any>(null);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [userMeals, setUserMeals] = useState<any[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [shoppingListRecipes, setShoppingListRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!user) { 
      setLoading(false); 
      setProfile(null);
      setRecipes([]);
      setUserMeals([]);
      setShoppingList([]);
      return; 
    }

    setLoading(true);
    try {
      const [
        profileResData,
        recipesRes,
        mealsRes,
        slRes,
        slrRes
      ] = await Promise.all([
        api.profile.get().catch(() => null),
        api.recipes.getAll().catch(() => []),
        api.meals.getAll().catch(() => []),
        api.shoppingList.getItems().catch(() => []),
        api.shoppingList.getRecipes().catch(() => []),
      ]);

      if (profileResData) {
        setProfile(parseProfileJSON(profileResData));
      } else {
        setProfile(null);
      }
      setRecipes(recipesRes);
      setUserMeals(mealsRes);
      setShoppingList(slRes);

      if (slrRes && slrRes.length > 0) {
        const mappedRecipes = slrRes.map((r: any) => ({ ...r.recipe, portions: r.portions })).filter(Boolean);
        const uniqueSrc = Array.from(new Map(mappedRecipes.map((r: any) => [r.id, r])).values());
        setShoppingListRecipes(uniqueSrc);
      } else {
        setShoppingListRecipes([]);
      }
    } catch (err) {
      console.error("Error loading application data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const data = await api.profile.get().catch(() => null);
    if (data) setProfile(parseProfileJSON(data));
  }, [user]);

  const saveProfile = useCallback(async (changes: Record<string, unknown>) => {
    const saved = await api.profile.update(changes);
    setProfile((prev: Record<string, unknown> | null) => ({ ...prev, ...changes, ...parseProfileJSON(saved) }));
    return saved;
  }, []);

  const refreshRecipes = useCallback(async () => {
    const data = await api.recipes.getAll().catch(() => []);
    setRecipes(data);
  }, []);

  const refreshMeals = useCallback(async () => {
    if (!user) return;
    const data = await api.meals.getAll().catch(() => []);
    setUserMeals(data);
  }, [user]);

  const refreshShoppingList = useCallback(async () => {
    if (!user) return;
    const [slRes, slrRes] = await Promise.all([
      api.shoppingList.getItems().catch(() => []),
      api.shoppingList.getRecipes().catch(() => [])
    ]);

    setShoppingList(slRes);
    if (slrRes && slrRes.length > 0) {
       const mappedRecipes = slrRes.map((r: any) => ({ ...r.recipe, portions: r.portions })).filter(Boolean);
       const uniqueSrc = Array.from(new Map(mappedRecipes.map((r: any) => [r.id, r])).values());
       setShoppingListRecipes(uniqueSrc);
    } else {
       setShoppingListRecipes([]);
    }
  }, [user]);

  const getConsumedForDay = useCallback((date: string) => {
    const visibleMealsList = Array.isArray(profile?.meal_config)
      ? profile.meal_config.filter((m: any) => m.visible).map((m: any) => m.id)
      : (profile?.visible_meals || ['breakfast', 'lunch', 'dinner', 'supper', 'snack1', 'snack2']);

    const mealsToday = userMeals.filter(m => m.date_str === date && visibleMealsList.includes(m.meal_type));
    let kcal = 0, protein = 0, fat = 0, carbs = 0;

    mealsToday.forEach(meal => {
      if (meal.recipe) {
        const rec = recipes.find(r => r.id === (meal.recipe?.id || meal.recipe));
        if (rec) {
          const mult = meal.portions_consumed || 1;
          kcal += Math.round(rec.kcal * mult);
          protein += parseFloat((rec.protein * mult).toFixed(1));
          fat += parseFloat((rec.fat * mult).toFixed(1));
          carbs += parseFloat((rec.carbs * mult).toFixed(1));
        }
      } else if (meal.product) {
        const prod = resolveMealProduct(meal, userMeals);
        if (prod) {
          const weight = meal.portions_consumed || 100;
          const factor = prod.unit === 'pc' ? weight : (weight / 100);
          kcal += Math.round(prod.kcal * factor);
          protein += parseFloat((prod.protein * factor).toFixed(1));
          fat += parseFloat((prod.fat * factor).toFixed(1));
          carbs += parseFloat((prod.carbs * factor).toFixed(1));
        }
      } else {
        kcal += Number(meal.manual_kcal) || 0;
        protein += Number(meal.manual_protein) || 0;
        fat += Number(meal.manual_fat) || 0;
        carbs += Number(meal.manual_carbs) || 0;
      }
    });

    return {
      kcal,
      protein: parseFloat(protein.toFixed(1)),
      fat: parseFloat(fat.toFixed(1)),
      carbs: parseFloat(carbs.toFixed(1))
    };
  }, [userMeals, recipes, profile]);

  return (
    <AppDataContext.Provider value={{
      user, profile, recipes, userMeals, shoppingList, shoppingListRecipes,
      loading, onLogout, refreshProfile, saveProfile, refreshRecipes, refreshMeals, refreshShoppingList,
      getConsumedForDay, setUserMeals, setShoppingList
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export const useAppData = () => useContext(AppDataContext);

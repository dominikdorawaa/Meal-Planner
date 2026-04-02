import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

interface AppData {
  user: any;
  profile: any;
  recipes: any[];
  products: any[];
  userMeals: any[];
  shoppingList: any[];
  shoppingListRecipes: any[];
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshRecipes: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshMeals: () => Promise<void>;
  refreshShoppingList: () => Promise<void>;
  getConsumedForDay: (date: string) => { kcal: number, protein: number, fat: number, carbs: number };
}

const AppDataContext = createContext<AppData>({
  user: null,
  profile: null,
  recipes: [],
  products: [],
  userMeals: [],
  shoppingList: [],
  shoppingListRecipes: [],
  loading: true,
  refreshProfile: async () => {},
  refreshRecipes: async () => {},
  refreshProducts: async () => {},
  refreshMeals: async () => {},
  refreshShoppingList: async () => {},
  getConsumedForDay: () => ({ kcal: 0, protein: 0, fat: 0, carbs: 0 }),
});

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [userMeals, setUserMeals] = useState<any[]>([]);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [shoppingListRecipes, setShoppingListRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { setLoading(false); return; }
    setUser(u);

    const [profileRes, recipesRes, productsRes, mealsRes, slRes, slrRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', u.id).single(),
      supabase.from('recipes').select('*').eq('is_archived', false),
      supabase.from('products').select('*'),
      supabase.from('user_meals').select('*').eq('user_id', u.id),
      supabase.from('shopping_list').select('*').eq('user_id', u.id).order('is_checked', { ascending: true }).order('ingredient_name', { ascending: true }),
      supabase.from('shopping_list_recipes').select('portions, recipes(*, recipe_ingredients(*))').eq('user_id', u.id),
    ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (recipesRes.data) setRecipes(recipesRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (mealsRes.data) setUserMeals(mealsRes.data);
    if (slRes.data) setShoppingList(slRes.data);
    
    if (slrRes.data && slrRes.data.length > 0) {
       const mappedRecipes = slrRes.data.map((r: any) => ({ ...r.recipes, portions: r.portions })).filter(Boolean);
       const uniqueSrc = Array.from(new Map(mappedRecipes.map((r: any) => [r.id, r])).values());
       setShoppingListRecipes(uniqueSrc);
    } else {
       setShoppingListRecipes([]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    if (data) setProfile(data);
  }, [user]);

  const refreshRecipes = useCallback(async () => {
    const { data } = await supabase.from('recipes').select('*').eq('is_archived', false);
    if (data) setRecipes(data);
  }, []);

  const refreshProducts = useCallback(async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) setProducts(data);
  }, []);

  const refreshMeals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('user_meals').select('*').eq('user_id', user.id);
    if (data) setUserMeals(data);
  }, [user]);

  const refreshShoppingList = useCallback(async () => {
    if (!user) return;
    const [slRes, slrRes] = await Promise.all([
      supabase.from('shopping_list').select('*').eq('user_id', user.id).order('is_checked', { ascending: true }).order('ingredient_name', { ascending: true }),
      supabase.from('shopping_list_recipes').select('portions, recipes(*, recipe_ingredients(*))').eq('user_id', user.id)
    ]);
    
    if (slRes.data) setShoppingList(slRes.data);
    if (slrRes.data && slrRes.data.length > 0) {
       const mappedRecipes = slrRes.data.map((r: any) => ({ ...r.recipes, portions: r.portions })).filter(Boolean);
       const uniqueSrc = Array.from(new Map(mappedRecipes.map((r: any) => [r.id, r])).values());
       setShoppingListRecipes(uniqueSrc);
    } else {
       setShoppingListRecipes([]);
    }
  }, [user]);

  const getConsumedForDay = useCallback((date: string) => {
    const visibleMealsList = profile?.meal_config
      ? profile.meal_config.filter((m: any) => m.visible).map((m: any) => m.id)
      : (profile?.visible_meals || ['breakfast', 'lunch', 'dinner', 'supper', 'snack1', 'snack2']);

    const mealsToday = userMeals.filter(m => m.date_str === date && visibleMealsList.includes(m.meal_type));
    let kcal = 0, protein = 0, fat = 0, carbs = 0;

    mealsToday.forEach(meal => {
      if (meal.recipe_id) {
        const rec = recipes.find(r => r.id === meal.recipe_id);
        if (rec) {
          const mult = meal.portions_consumed || 1;
          kcal += Math.round(rec.kcal * mult);
          protein += parseFloat((rec.protein * mult).toFixed(1));
          fat += parseFloat((rec.fat * mult).toFixed(1));
          carbs += parseFloat((rec.carbs * mult).toFixed(1));
        }
      } else if (meal.product_id) {
        const prod = products.find(p => p.id === meal.product_id);
        if (prod) {
          // Dla produktów portions_consumed to waga w gramach (lub sztuki, ale przeliczone na gramy)
          // Makroskładniki w bazie produktów są podane na 100g (chyba że unit='pc')
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
      user, profile, recipes, products, userMeals, shoppingList, shoppingListRecipes, 
      loading, refreshProfile, refreshRecipes, refreshProducts, refreshMeals, refreshShoppingList,
      getConsumedForDay
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export const useAppData = () => useContext(AppDataContext);

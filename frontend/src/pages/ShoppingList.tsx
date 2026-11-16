import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { useAppData } from '../lib/AppDataContext';
import { BottomNav } from '../components/BottomNav';
import { RecipeCoverImage } from '../components/RecipeCoverImage';
import { recipeCoverImage, type RecipeImageInput } from '../lib/recipeImage';
import { ShoppingFromPlanPicker } from '../components/ShoppingFromPlanPicker';
import { ShoppingAddProductSheet } from '../components/ShoppingAddProductSheet';
import { ShoppingItemRow } from '../components/ShoppingItemRow';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { UndoSnackbar } from '../components/UndoSnackbar';
import { pluralForm, t } from '../i18n';
import { ingredientBaseAmountLabel, ingredientUnitLabel } from '../lib/recipeIngredient';
import { profileMealTypes } from '../lib/mealTypes';
import { addPlanMealsToShoppingList, type PlanMeal, type ShoppingFromPlanResult } from '../lib/shoppingFromPlan';
import { formatShoppingAmount, groupByShoppingCategory } from '../lib/shoppingCategories';

const SUCCESS_TOAST_MS = 3500;
export const SHOPPING_GROUPED_STORAGE_KEY = 'mp_shopping_grouped';

const FROM_PLAN_MESSAGES: Record<Exclude<ShoppingFromPlanResult, 'added'>, Parameters<typeof t>[0]> = {
  'no-recipes': 'shopping.noRecipesSelected',
  'no-ingredients': 'shopping.noIngredients',
};

interface ShoppingItem {
  id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  is_checked?: boolean;
}

type IngredientAmount = Parameters<typeof ingredientBaseAmountLabel>[0];

interface SourceIngredient {
  name: string;
  amount: number | string;
  unit: IngredientAmount['unit'];
  product?: IngredientAmount['product'];
}

interface SourceRecipe {
  id: string;
  name: string;
  kcal?: number | string | null;
  images?: (RecipeImageInput | null)[] | null;
  portions: number;
  ingredients?: SourceIngredient[];
  recipe?: SourceRecipe;
}

type Snackbar = { id: number; message: string; removed?: ShoppingItem };

const CARD = 'bg-surface-container-low rounded-2xl px-4';
const PILL = 'h-[34px] px-3.5 rounded-full text-[13px] font-semibold transition-colors';

function restoreAt(list: ShoppingItem[], target: ShoppingItem, index: number): ShoppingItem[] {
  if (list.some(other => other.id === target.id)) return list;
  const next = [...list];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, target);
  return next;
}

export function ShoppingList() {
  const navigate = useNavigate();
  const { shoppingList, shoppingListRecipes, refreshShoppingList, setShoppingList, userMeals, recipes, profile } = useAppData();
  const items: ShoppingItem[] = shoppingList || [];
  const sourceRecipes: SourceRecipe[] = shoppingListRecipes || [];
  const [activeTab, setActiveTab] = useState<'products' | 'recipes'>('products');
  const [grouped, setGrouped] = useState(() => localStorage.getItem(SHOPPING_GROUPED_STORAGE_KEY) !== '0');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFromPlan, setShowFromPlan] = useState(false);
  const [fromPlanSubmitting, setFromPlanSubmitting] = useState(false);
  const [fromPlanError, setFromPlanError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<Snackbar | null>(null);
  const pendingMutations = useRef(0);

  const showSnackbar = (message: string, removed?: ShoppingItem) =>
    setSnackbar(previous => ({ id: (previous?.id ?? 0) + 1, message, removed }));
  const closeSnackbar = useCallback(() => setSnackbar(null), []);

  const runMutation = async (action: () => Promise<void>, label: string, onFailure: () => void) => {
    pendingMutations.current += 1;
    try {
      await action();
    } catch (err) {
      console.error(label, err);
      onFailure();
      return;
    } finally {
      pendingMutations.current -= 1;
    }
    if (pendingMutations.current === 0) {
      await refreshShoppingList().catch(err => console.error('Error refreshing shopping list:', err));
    }
  };

  const toggleGrouped = () => {
    const next = !grouped;
    setGrouped(next);
    localStorage.setItem(SHOPPING_GROUPED_STORAGE_KEY, next ? '1' : '0');
  };

  const toggleCheck = (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setShoppingList((prev: ShoppingItem[]) =>
      prev.map(item => (item.id === id ? { ...item, is_checked: nextStatus } : item)),
    );
    return runMutation(
      async () => {
        await api.shoppingList.toggleItem(id, nextStatus);
      },
      'Error toggling item:',
      () => {
        setShoppingList((prev: ShoppingItem[]) =>
          prev.map(item => (item.id === id ? { ...item, is_checked: currentStatus } : item)),
        );
      },
    );
  };

  const removeItem = (item: ShoppingItem) => {
    const index = items.findIndex(other => other.id === item.id);
    setShoppingList((prev: ShoppingItem[]) => prev.filter(other => other.id !== item.id));
    return runMutation(
      async () => {
        await api.shoppingList.deleteItem(item.id);
        showSnackbar(t('shopping.itemRemoved'), item);
      },
      'Error removing item:',
      () => {
        setShoppingList((prev: ShoppingItem[]) => restoreAt(prev, item, index));
        showSnackbar(t('shopping.removeFailed'));
      },
    );
  };

  const restoreItem = (item: ShoppingItem) => {
    setSnackbar(null);
    return runMutation(
      async () => {
        await api.shoppingList.addItem({
          ingredient_name: item.ingredient_name,
          quantity: item.quantity,
          unit: item.unit,
          is_checked: !!item.is_checked,
        });
      },
      'Error restoring item:',
      () => showSnackbar(t('shopping.addFailed')),
    );
  };

  const openFromPlan = () => {
    setFromPlanError(null);
    setShowFromPlan(true);
  };

  const closeFromPlan = useCallback(() => setShowFromPlan(false), []);
  const closeAddModal = useCallback(() => setShowAddModal(false), []);

  const handleAddFromPlan = async (meals: PlanMeal[]) => {
    setFromPlanError(null);
    setFromPlanSubmitting(true);
    try {
      const result = await addPlanMealsToShoppingList(meals);
      if (result !== 'added') {
        setFromPlanError(t(FROM_PLAN_MESSAGES[result]));
        return;
      }
    } catch (err) {
      console.error('Error generating shopping list:', err);
      setFromPlanError(t('shopping.fromPlanFailed'));
      return;
    } finally {
      setFromPlanSubmitting(false);
    }
    setShowFromPlan(false);
    showSnackbar(t('shopping.ingredientsAdded'));
    await refreshShoppingList().catch(err => console.error('Error refreshing shopping list:', err));
  };

  const clearList = () => {
    const previous = items;
    setShowConfirm(false);
    setSnackbar(current => (current?.removed ? null : current));
    setShoppingList([]);
    return runMutation(
      async () => {
        await api.shoppingList.clearAll();
      },
      'Error clearing list:',
      () => {
        setShoppingList((prev: ShoppingItem[]) => (prev.length === 0 ? previous : prev));
        showSnackbar(t('shopping.clearFailed'));
      },
    );
  };

  const groups = groupByShoppingCategory(items);
  const boughtCount = items.filter(item => item.is_checked).length;

  const itemRow = (item: ShoppingItem) => (
    <ShoppingItemRow
      key={item.id}
      name={item.ingredient_name}
      amount={`${formatShoppingAmount(item.quantity, item.unit)} ${item.unit}`}
      checked={!!item.is_checked}
      onToggle={() => toggleCheck(item.id, !!item.is_checked)}
      onRemove={() => removeItem(item)}
    />
  );

  const recipeAmount = (ingredient: SourceIngredient, portions: number) => {
    const amount = Number(ingredient.amount) * portions;
    const base = ingredientBaseAmountLabel({ amount, unit: ingredient.unit, product: ingredient.product });
    return `${formatShoppingAmount(amount, ingredient.unit)} ${ingredientUnitLabel(ingredient.unit, amount, ingredient.product)}${base ? ` (${base})` : ''}`;
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-bottom-nav">
      <main className="pt-[calc(1rem+env(safe-area-inset-top))] max-w-xl mx-auto px-4">
        <div className="flex items-center gap-2.5 pl-1 pb-3">
          <h1 className="font-headline font-extrabold text-xl tracking-tight text-on-surface">{t('nav.shopping')}</h1>
          <p className="flex-1 min-w-0 truncate pt-0.5 text-[13px] font-medium text-on-surface-variant tabular-nums">
            {items.length > 0 && t('shopping.progress', { done: boughtCount, total: items.length })}
          </p>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            aria-label={t('shopping.clearConfirm')}
            className="w-10 h-10 -my-1 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high active:scale-95 transition-colors"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[22px]">delete_sweep</span>
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={openFromPlan}
            className="flex-1 min-w-0 h-12 px-3 rounded-2xl bg-primary text-on-primary flex items-center justify-center gap-1.5 font-semibold text-sm whitespace-nowrap active:scale-[0.98] transition-transform"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[19px]">event_note</span>
            {t('shopping.fromPlan')}
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex-1 min-w-0 h-12 px-3 rounded-2xl bg-surface-container-high text-on-surface flex items-center justify-center gap-1.5 font-semibold text-sm whitespace-nowrap active:scale-[0.98] transition-transform"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[19px]">add</span>
            {t('shopping.addProduct')}
          </button>
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          {(['products', 'recipes'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`${PILL} ${activeTab === tab ? 'bg-surface-container-high text-on-surface' : 'bg-surface-container-low text-on-surface-variant'}`}
            >
              {t(tab === 'products' ? 'shopping.viewProducts' : 'shopping.viewRecipes')}
            </button>
          ))}
          {activeTab === 'products' && (
            <button
              type="button"
              aria-pressed={grouped}
              aria-label={t('shopping.groupByCategory')}
              onClick={toggleGrouped}
              className={`ml-auto w-10 h-10 -my-1 rounded-full flex items-center justify-center active:scale-95 transition-colors ${grouped ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[21px]">shelves</span>
            </button>
          )}
        </div>

        {activeTab === 'products' ? (
          items.length === 0 ? (
            <div className="pt-16 px-6 text-center">
              <p className="font-headline font-extrabold text-base tracking-tight text-on-surface">{t('shopping.empty')}</p>
              <p className="mt-1.5 text-sm text-on-surface-variant text-balance">{t('shopping.emptyHint')}</p>
            </div>
          ) : grouped ? (
            <div className="flex flex-col gap-5">
              {groups.map(group => (
                <section key={group.category.id}>
                  <div className="flex items-baseline gap-2 px-1 pb-2">
                    <h2 className="flex-1 min-w-0 font-headline font-extrabold text-[15px] tracking-tight text-on-surface">{t(group.category.labelKey)}</h2>
                    <span className="text-[12.5px] text-on-surface-variant tabular-nums">{group.items.length}</span>
                  </div>
                  <ul className={CARD}>{group.items.map(itemRow)}</ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className={CARD}>{items.map(itemRow)}</ul>
          )
        ) : (
          <div className="flex flex-col gap-5">
            {sourceRecipes.map((r, idx) => {
              const recipe = r.recipe ?? r;
              const kcal = Math.round(Number(recipe.kcal) || 0);
              return (
                <section key={recipe.id ?? idx}>
                  <button
                    type="button"
                    onClick={() => navigate(`/recipe/${recipe.id}`)}
                    className="w-full flex items-center gap-3 px-1 pb-2.5 text-left active:opacity-70 transition-opacity"
                  >
                    <span className="block w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-surface-container-high">
                      <RecipeCoverImage image={recipeCoverImage(recipe)} alt="" className="w-full h-full" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-headline font-extrabold text-[15px] leading-tight tracking-tight text-on-surface line-clamp-2">{recipe.name}</span>
                      <span className="block mt-0.5 text-[12.5px] text-on-surface-variant tabular-nums">
                        {t(`shopping.portions.${pluralForm(r.portions)}`, { count: r.portions })},{' '}
                        <span className="font-semibold text-primary">{kcal} kcal</span>
                      </span>
                    </span>
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
                  </button>
                  {r.ingredients && r.ingredients.length > 0 ? (
                    <ul className={CARD}>
                      {r.ingredients.map((ing, i) => {
                        const shopItem = items.find(it => (it.ingredient_name || '').toLowerCase() === (ing.name || '').toLowerCase());
                        return (
                          <ShoppingItemRow
                            key={i}
                            name={ing.name}
                            amount={recipeAmount(ing, r.portions)}
                            checked={!!shopItem?.is_checked}
                            disabled={!shopItem}
                            onToggle={() => shopItem && toggleCheck(shopItem.id, !!shopItem.is_checked)}
                          />
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="px-1 text-sm text-on-surface-variant">{t('shopping.noRecipeIngredients')}</p>
                  )}
                </section>
              );
            })}
            {sourceRecipes.length === 0 && (
              <p className="pt-12 px-6 text-center text-sm text-on-surface-variant">{t('shopping.noSourceRecipes')}</p>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      {snackbar && (
        <UndoSnackbar
          key={snackbar.id}
          message={snackbar.message}
          onUndo={snackbar.removed ? () => restoreItem(snackbar.removed!) : undefined}
          onClose={closeSnackbar}
          durationMs={snackbar.removed ? undefined : SUCCESS_TOAST_MS}
        />
      )}

      {showFromPlan && (
        <ShoppingFromPlanPicker
          meals={userMeals}
          recipes={recipes}
          mealTypes={profileMealTypes(profile)}
          submitting={fromPlanSubmitting}
          error={fromPlanError}
          onConfirm={handleAddFromPlan}
          onClose={closeFromPlan}
        />
      )}

      {showAddModal && <ShoppingAddProductSheet onAdded={refreshShoppingList} onClose={closeAddModal} />}

      {showConfirm && (
        <ConfirmSheet
          title={t('shopping.clearQuestion')}
          description={t('shopping.clearText')}
          confirmLabel={t('shopping.clearConfirm')}
          onConfirm={clearList}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

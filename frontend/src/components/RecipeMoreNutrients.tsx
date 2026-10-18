import { t } from '../i18n';
import { EXTRA_NUTRIENTS, recipeExtraNutrientsPerPortion, type IngredientWithProduct } from '../lib/nutrients';
import { NutritionFactsTable } from './NutritionFactsTable';

interface RecipeMoreNutrientsProps {
  ingredients: IngredientWithProduct[];
  portions: number;
}

export function RecipeMoreNutrients({ ingredients, portions }: RecipeMoreNutrientsProps) {
  const perPortion = recipeExtraNutrientsPerPortion(ingredients, portions);

  if (!perPortion) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-on-surface opacity-40">{t('nutrients.recipeTitle')}</h2>
        <p className="text-sm font-medium text-on-surface-variant">{t('nutrients.incompleteData')}</p>
      </section>
    );
  }

  return (
    <NutritionFactsTable
      title={t('nutrients.recipeTitle')}
      columns={[{ label: t('nutrients.recipePortion'), values: perPortion }]}
      facts={EXTRA_NUTRIENTS}
    />
  );
}

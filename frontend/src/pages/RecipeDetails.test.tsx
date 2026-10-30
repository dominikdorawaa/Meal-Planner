import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RecipeDetails } from './RecipeDetails';
import { t } from '../i18n';
import { measure, withMeasures } from '../lib/measureFixtures';
import { toIsoDate, todayIsoDate } from '../lib/planDates';

const mocks = vi.hoisted(() => ({
  getRecipe: vi.fn(),
  archive: vi.fn(),
  save: vi.fn(),
  unsave: vi.fn(),
  addMeal: vi.fn(),
  updateMeal: vi.fn(),
  getAllMeals: vi.fn(),
  refreshMeals: vi.fn(),
  refreshRecipes: vi.fn(),
  announceDeletedRecipe: vi.fn(),
  profile: null as unknown,
  getConsumedForDay: vi.fn(),
}));

vi.mock('../lib/apiClient', () => ({
  api: {
    recipes: { getById: mocks.getRecipe, archive: mocks.archive, save: mocks.save, unsave: mocks.unsave },
    meals: { add: mocks.addMeal, update: mocks.updateMeal, getAll: mocks.getAllMeals },
  },
}));

vi.mock('../lib/AppDataContext', () => ({
  useAppData: () => ({
    user: { userId: 'user-1' },
    profile: mocks.profile,
    refreshMeals: mocks.refreshMeals,
    refreshRecipes: mocks.refreshRecipes,
    getConsumedForDay: mocks.getConsumedForDay,
  }),
}));

vi.mock('../lib/deletedRecipe', () => ({
  announceDeletedRecipe: mocks.announceDeletedRecipe,
}));

const BANANA = { id: 'p1', name: 'Banan', kcal: 89, protein: 1.1, fat: 0.3, carbs: 23, unit: '100g' };
const OWN_RECIPE = {
  id: 'r1',
  name: 'Owsianka bananowa',
  kcal: 89,
  protein: 1.1,
  fat: 0.3,
  carbs: 23,
  portions: 4,
  own: true,
  saved: false,
  instructions: ['Pokrój banana', 'Wymieszaj'],
  ingredients: [{ id: 'i1', name: 'Banan', amount: 400, unit: 'g', product: BANANA }],
};
const BASE_RECIPE = { ...OWN_RECIPE, id: 'r2', name: 'Sałatka bazowa', own: false, saved: false, instructions: [], ingredients: [] };

function renderDetails(path = '/recipe/r1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>plan screen</p>} />
        <Route path="/recipes" element={<p>recipes screen</p>} />
        <Route path="/recipe/:id" element={<RecipeDetails />} />
        <Route path="/edit-recipe/:id" element={<p>edit screen</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function openMenu() {
  fireEvent.click(await screen.findByRole('button', { name: t('recipeDetails.menu') }));
  return within(screen.getByRole('dialog'));
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.profile = null;
  mocks.getConsumedForDay.mockImplementation(() => ({ kcal: 1000, protein: 50, fat: 30, carbs: 100 }));
  mocks.getRecipe.mockResolvedValue(OWN_RECIPE);
  mocks.archive.mockResolvedValue({ ...OWN_RECIPE, is_archived: true });
  mocks.save.mockResolvedValue(undefined);
  mocks.unsave.mockResolvedValue(undefined);
  mocks.addMeal.mockResolvedValue({});
  mocks.updateMeal.mockResolvedValue({});
  mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 2, measure_code: 'g', measure_amount: 200 }]);
  mocks.refreshMeals.mockResolvedValue(undefined);
  mocks.refreshRecipes.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function tapOutside() {
  fireEvent.click(screen.getByRole('dialog').parentElement!);
}

describe('RecipeDetails loading', () => {
  it('loads the recipe once and shows nutrition of one portion', async () => {
    renderDetails();

    expect(await screen.findByRole('heading', { name: 'Owsianka bananowa' })).toBeTruthy();
    expect(screen.getByText(t('recipeDetails.kcalPortion', { grams: 100 }))).toBeTruthy();
    expect(screen.getByText(`${t('recipeDetails.nutritionTitle')} ${t('recipeDetails.nutritionForPortions', { count: 1, portions: 'porcja' })}`)).toBeTruthy();
    expect(screen.getByText(t('recipeDetails.ingredientsFor', { portions: t('recipeDetails.portionsAccusative.few', { count: 4 }) }))).toBeTruthy();
    expect(screen.getByText(t('recipeDetails.recipeFor', { portions: t('recipeDetails.portionsAccusative.few', { count: 4 }) }))).toBeTruthy();
    expect(screen.getByText('400 g')).toBeTruthy();
    expect(screen.getByText('Pokrój banana')).toBeTruthy();
    expect(mocks.getRecipe).toHaveBeenCalledTimes(1);
  });

  it('names ingredient measures in their declined form', async () => {
    const banana = withMeasures(BANANA, measure('piece', 120));
    mocks.getRecipe.mockResolvedValue({
      ...OWN_RECIPE,
      ingredients: [
        { id: 'i1', name: 'Banan', amount: 8, unit: 'piece', product: banana },
        { id: 'i2', name: 'Miód', amount: 20, unit: 'tbsp', product: null },
      ],
    });
    renderDetails();

    expect(await screen.findByText('8 sztuk (960 g)')).toBeTruthy();
    expect(screen.getByText('20 tbsp')).toBeTruthy();
  });

  it('shows the nutrition of each ingredient for the chosen portions', async () => {
    mocks.getRecipe.mockResolvedValue({
      ...OWN_RECIPE,
      ingredients: [
        ...OWN_RECIPE.ingredients,
        { id: 'i2', name: 'Miód', amount: 20, unit: 'g', product: null },
      ],
    });
    renderDetails();
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    const [banana, honey] = screen.getAllByTestId('recipe-ingredient');
    expect(within(banana).getByText('356 kcal')).toBeTruthy();
    expect(within(banana).getByText('B 4.4 g · T 1.2 g · W 92 g')).toBeTruthy();
    expect(within(honey).getByText(t('nutrients.noData'))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.morePortions') }));
    expect(within(screen.getAllByTestId('recipe-ingredient')[0]).getByText('401 kcal')).toBeTruthy();
  });

  it('opens one table per portion from the carbs ring, whatever amount is chosen', async () => {
    const banana = { ...BANANA, saturated_fat: 0.1, sugars: 12, fiber: 2.6, salt: 0 };
    mocks.getRecipe.mockResolvedValue({ ...OWN_RECIPE, ingredients: [{ ...OWN_RECIPE.ingredients[0], product: banana }] });
    renderDetails();
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.morePortions') }));
    const toggle = screen.getByRole('button', { name: t('nutrients.showTable', { value: '23g' }) });
    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('columnheader', { name: t('nutrients.recipePortion') })).toBeTruthy();
    const cells = screen.getAllByRole('row').slice(1).map(row => within(row).getByRole('cell').textContent);
    expect(cells).toEqual(['89 kcal', '1.1 g', '0.3 g', '0.1 g', '23 g', '12 g', '2.6 g', '0 g']);

    fireEvent.click(screen.getByRole('button', { name: t('nutrients.hideTable', { value: '23g' }) }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a dash for nutrients that an ingredient has no data for', async () => {
    mocks.getRecipe.mockResolvedValue({
      ...OWN_RECIPE,
      ingredients: [...OWN_RECIPE.ingredients, { id: 'i2', name: 'Miód', amount: 20, unit: 'g', product: null }],
    });
    renderDetails();

    fireEvent.click(await screen.findByRole('button', { name: t('nutrients.showTable', { value: '23g' }) }));
    expect(within(screen.getByRole('row', { name: /Wartość energetyczna/ })).getByRole('cell').textContent).toBe('89 kcal');
    for (const name of [/nasycone/, /Cukry/, /Błonnik/, /Sól/]) {
      expect(within(screen.getByRole('row', { name })).getByRole('cell').textContent).toBe('-');
    }
  });

  it('sums nutrients of the ingredients that have them and names the ones that do not', async () => {
    const banana = { ...BANANA, saturated_fat: 0.1, sugars: 12, fiber: 2.6, salt: 0 };
    const soySauce = { id: 'p2', name: 'Sos sojowy', kcal: 60, protein: 8, fat: 0, carbs: 6, unit: '100g', saturated_fat: 0, sugars: null, fiber: 0, salt: 14 };
    mocks.getRecipe.mockResolvedValue({
      ...OWN_RECIPE,
      ingredients: [
        { ...OWN_RECIPE.ingredients[0], product: banana },
        { id: 'i2', name: 'Miód', amount: 20, unit: 'g', product: null },
        { id: 'i3', name: 'Sos sojowy', amount: 20, unit: 'g', product: soySauce },
      ],
    });
    renderDetails();

    fireEvent.click(await screen.findByRole('button', { name: t('nutrients.showTable', { value: '23g' }) }));
    expect(within(screen.getByRole('row', { name: /^Sól/ })).getByRole('cell').textContent).toBe('0.7 g');
    expect(within(screen.getByRole('row', { name: /^Cukry/ })).getByRole('cell').textContent).toBe('12 g');
    expect(screen.getByText(t('nutrients.incomplete', { names: 'Miód, Sos sojowy' }))).toBeTruthy();
    expect(screen.getAllByText(t('nutrients.incomplete', { names: 'Miód' }))).toHaveLength(3);
  });

  it('tells that nutrition is incomplete and lets the author choose the missing products', async () => {
    mocks.getRecipe.mockResolvedValue({
      ...OWN_RECIPE,
      ingredients: [...OWN_RECIPE.ingredients, { id: 'i2', name: 'Miód', amount: 20, unit: 'g', product: null }, { id: 'i3', name: 'Sól', amount: 1, unit: 'g' }],
    });
    renderDetails();

    expect(await screen.findByText(t('recipeDetails.incompleteNutrition', { names: 'Miód, Sól' }))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.completeProducts') }));
    expect(screen.getByText('edit screen')).toBeTruthy();
  });

  it('tells others that nutrition is incomplete without offering to edit', async () => {
    mocks.getRecipe.mockResolvedValue({
      ...BASE_RECIPE,
      ingredients: [{ id: 'i2', name: 'Miód', amount: 20, unit: 'g', product: null }],
    });
    renderDetails('/recipe/r2');

    expect(await screen.findByText(t('recipeDetails.incompleteNutrition', { names: 'Miód' }))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('recipeDetails.completeProducts') })).toBeNull();
  });

  it('does not warn when every ingredient has a product', async () => {
    renderDetails();
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });
    expect(screen.queryByRole('button', { name: t('recipeDetails.completeProducts') })).toBeNull();
    expect(screen.queryByText(/Wartości odżywcze nie są pełne/)).toBeNull();
  });

  it('recalculates calories for the typed weight', async () => {
    renderDetails();
    const grams = await screen.findByLabelText(t('recipeDetails.gramsInput'));

    fireEvent.change(grams, { target: { value: '200' } });

    expect(screen.getByText(`${t('recipeDetails.nutritionTitle')} ${t('recipeDetails.nutritionForGrams', { grams: 200 })}`)).toBeTruthy();
    expect(screen.getAllByText('178').length).toBeGreaterThan(0);
  });

  it('scales the ingredients with the portion stepper and quick picks', async () => {
    renderDetails();
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    expect(screen.queryByRole('button', { name: t('recipeDetails.wholeRecipe') })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.morePortions') }));
    expect(screen.getByText('450 g')).toBeTruthy();
    expect(screen.getByText(t('recipeDetails.ingredientsFor', { portions: t('recipeDetails.portionsAccusative.fraction', { count: 4.5 }) }))).toBeTruthy();
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.fewerPortions') }));
    }
    expect(screen.getByText('50 g')).toBeTruthy();
    expect(screen.getByText(t('recipeDetails.ingredientsFor', { portions: t('recipeDetails.portionsAccusative.fraction', { count: 0.5 }) }))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.wholeRecipe') }));
    expect(screen.getByText('400 g')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('recipeDetails.wholeRecipe') })).toBeNull();

    expect(screen.getAllByRole('button', { name: /kcal$/ }).map(button => button.textContent)).toEqual(['45 kcal', '89 kcal', '134 kcal', '178 kcal']);
    fireEvent.click(screen.getByRole('button', { name: '45 kcal' }));
    expect(screen.getByText(t('recipeDetails.kcalPortion', { grams: 50 }))).toBeTruthy();
    expect(screen.getByText('400 g')).toBeTruthy();
  });

  it('uses the plural form of portions in the calculator', async () => {
    renderDetails();
    const portions = await screen.findByLabelText(t('recipeDetails.portionsInput'));

    fireEvent.change(portions, { target: { value: '2' } });
    expect(screen.getByText(t('recipeDetails.portionWord.few'))).toBeTruthy();
    fireEvent.change(portions, { target: { value: '5' } });
    expect(screen.getByText(t('recipeDetails.portionWord.many'))).toBeTruthy();
  });

  it('shows a message with a way back when the recipe cannot be loaded', async () => {
    mocks.getRecipe.mockRejectedValue(new Error('Not found'));
    renderDetails();

    expect(await screen.findByText(t('recipeDetails.notFound'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.back') }));
    expect(screen.getByText('recipes screen')).toBeTruthy();
  });

  it('opens a plan entry added by weight with its grams and saves a changed amount', async () => {
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');

    await waitFor(() => expect((screen.getByLabelText(t('recipeDetails.gramsInput')) as HTMLInputElement).value).toBe('200'));
    expect((screen.getByLabelText(t('recipeDetails.portionsInput')) as HTMLInputElement).value).toBe('1');
    expect(screen.getByTestId('grams-kcal').className).toContain('text-primary');
    expect(screen.getByTestId('portions-kcal').className).not.toContain('text-primary');
    const update = screen.getByRole('button', { name: t('recipeDetails.update') }) as HTMLButtonElement;
    expect(update.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(t('recipeDetails.gramsInput')), { target: { value: '300' } });
    expect(update.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText(t('recipeDetails.gramsInput')), { target: { value: '200' } });
    expect(update.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(t('recipeDetails.portionsInput')), { target: { value: '3' } });
    fireEvent.click(update);

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 3, measure_code: 'portion', measure_amount: null });
  });

  it('opens a plan entry added by portions with the portions highlighted and the grams left alone', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 2, measure_code: 'portion', measure_amount: null }]);
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');

    await waitFor(() => expect((screen.getByLabelText(t('recipeDetails.portionsInput')) as HTMLInputElement).value).toBe('2'));
    expect((screen.getByLabelText(t('recipeDetails.gramsInput')) as HTMLInputElement).value).toBe('100');
    expect(screen.getByTestId('portions-kcal').className).toContain('text-primary');
    expect(screen.getByTestId('grams-kcal').className).not.toContain('text-primary');
  });

  it('opens an older plan entry without a saved method in portions', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 2 }]);
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');

    await waitFor(() => expect(screen.getByTestId('portions-kcal').className).toContain('text-primary'));
    expect((screen.getByLabelText(t('recipeDetails.portionsInput')) as HTMLInputElement).value).toBe('2');
  });

  it('lets a plan entry switch to a quick pick of the same amount', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 1, measure_code: 'portion', measure_amount: null }]);
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');
    await waitFor(() => expect(screen.getByTestId('portions-kcal').className).toContain('text-primary'));
    const update = screen.getByRole('button', { name: t('recipeDetails.update') }) as HTMLButtonElement;
    expect(update.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '89 kcal' }));
    expect(update.disabled).toBe(false);
    fireEvent.click(update);

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 1, measure_code: 'quick-pick', measure_amount: null });
  });

  it('calculates the grams again when the recipe weight changed after the entry was saved', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 2, measure_code: 'g', measure_amount: 150 }]);
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');

    await waitFor(() => expect((screen.getByLabelText(t('recipeDetails.gramsInput')) as HTMLInputElement).value).toBe('200'));
    expect(screen.getByTestId('kcal-value').textContent).toBe(screen.getByTestId('grams-kcal').textContent);
  });

  it('opens a plan entry added by a quick pick with that pick highlighted', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 0.5, measure_code: 'quick-pick', measure_amount: null }]);
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');

    await waitFor(() => expect(screen.getByRole('button', { name: '45 kcal' }).className).toContain('bg-[#e2f0d9]'));
    expect(screen.getByTestId('portions-kcal').className).not.toContain('text-primary');
    expect((screen.getByRole('button', { name: t('recipeDetails.update') }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves how the amount was chosen when changing a plan entry by weight', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 2, measure_code: 'portion', measure_amount: null }]);
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');
    await waitFor(() => expect((screen.getByLabelText(t('recipeDetails.portionsInput')) as HTMLInputElement).value).toBe('2'));

    fireEvent.change(screen.getByLabelText(t('recipeDetails.gramsInput')), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.update') }));

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 1.5, measure_code: 'g', measure_amount: 150 });
  });

  it('blocks updating a plan entry with an empty or zero amount', async () => {
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');
    await waitFor(() => expect((screen.getByLabelText(t('recipeDetails.gramsInput')) as HTMLInputElement).value).toBe('200'));
    const update = screen.getByRole('button', { name: t('recipeDetails.update') }) as HTMLButtonElement;

    fireEvent.change(screen.getByLabelText(t('recipeDetails.gramsInput')), { target: { value: '0' } });
    expect(update.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(t('recipeDetails.gramsInput')), { target: { value: '' } });
    expect(update.disabled).toBe(true);
  });

  it('tells when a plan entry cannot be updated', async () => {
    mocks.updateMeal.mockRejectedValue(new Error('Server error'));
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');
    await waitFor(() => expect((screen.getByLabelText(t('recipeDetails.gramsInput')) as HTMLInputElement).value).toBe('200'));

    fireEvent.change(screen.getByLabelText(t('recipeDetails.gramsInput')), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.update') }));

    expect(await screen.findByText(t('recipeDetails.updateFailed'))).toBeTruthy();
  });
});

describe('RecipeDetails own recipe actions', () => {
  it('offers editing and deleting only in the menu of an own recipe', async () => {
    renderDetails();
    const menu = await openMenu();

    expect(menu.getByText(t('recipeDetails.edit'))).toBeTruthy();
    expect(menu.getByText(t('recipeDelete.confirm'))).toBeTruthy();

    fireEvent.click(menu.getByText(t('recipeDetails.edit')));
    expect(screen.getByText('edit screen')).toBeTruthy();
  });

  it('lets the author save their own recipe with the heart on the photo', async () => {
    renderDetails();
    fireEvent.click(await screen.findByRole('button', { name: t('recipeDetails.save') }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('r1'));
    expect(screen.getByRole('button', { name: t('recipeDetails.menu') })).toBeTruthy();
  });

  it('closes the menu when tapping outside or cancelling', async () => {
    renderDetails();
    await openMenu();

    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();

    const menu = await openMenu();
    fireEvent.click(menu.getByRole('button', { name: t('common.cancel') }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('deletes the recipe after confirming in the sheet and offers undo', async () => {
    renderDetails();
    const menu = await openMenu();
    fireEvent.click(menu.getByText(t('recipeDelete.confirm')));

    const sheet = within(screen.getByRole('alertdialog'));
    expect(sheet.getByText('Owsianka bananowa')).toBeTruthy();
    expect(sheet.getByText(t('recipeDelete.text'))).toBeTruthy();
    fireEvent.click(sheet.getByRole('button', { name: t('recipeDelete.confirm') }));

    await screen.findByText('recipes screen');
    expect(mocks.archive).toHaveBeenCalledWith('r1');
    expect(mocks.announceDeletedRecipe).toHaveBeenCalledWith({ id: 'r1', name: 'Owsianka bananowa' });
    expect(mocks.refreshRecipes).toHaveBeenCalled();
  });

  it('keeps the recipe when deleting is cancelled', async () => {
    renderDetails();
    fireEvent.click((await openMenu()).getByText(t('recipeDelete.confirm')));

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: t('common.cancel') }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(mocks.archive).not.toHaveBeenCalled();
  });

  it('tells when the recipe cannot be deleted', async () => {
    mocks.archive.mockRejectedValue(new Error('Server error'));
    renderDetails();
    fireEvent.click((await openMenu()).getByText(t('recipeDelete.confirm')));

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: t('recipeDelete.confirm') }));

    expect(await screen.findByText(t('recipeDelete.failed'))).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(mocks.announceDeletedRecipe).not.toHaveBeenCalled();
  });
});

describe('RecipeDetails base recipe', () => {
  beforeEach(() => {
    mocks.getRecipe.mockResolvedValue(BASE_RECIPE);
  });

  it('has no edit or delete actions but can be saved with the heart', async () => {
    renderDetails('/recipe/r2');
    const heart = await screen.findByRole('button', { name: t('recipeDetails.save') });

    expect(screen.queryByRole('button', { name: t('recipeDetails.menu') })).toBeNull();
    expect(heart.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(heart);

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('r2'));
    const saved = await screen.findByRole('button', { name: t('recipeDetails.unsave') });
    expect(saved.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(saved.hasAttribute('disabled')).toBe(false));
    expect(mocks.refreshRecipes).toHaveBeenCalled();

    fireEvent.click(saved);
    await waitFor(() => expect(mocks.unsave).toHaveBeenCalledWith('r2'));
    expect(await screen.findByRole('button', { name: t('recipeDetails.save') })).toBeTruthy();
  });

  it('starts filled for a saved recipe and goes back when saving fails', async () => {
    mocks.getRecipe.mockResolvedValue({ ...BASE_RECIPE, saved: true });
    mocks.unsave.mockRejectedValue(new Error('Server error'));
    renderDetails('/recipe/r2');

    fireEvent.click(await screen.findByRole('button', { name: t('recipeDetails.unsave') }));

    expect(await screen.findByText(t('recipeDetails.savedFailed'))).toBeTruthy();
    expect(screen.getByRole('button', { name: t('recipeDetails.unsave') })).toBeTruthy();
  });
});

describe('RecipeDetails adding to the plan', () => {
  it('adds the recipe for today to a meal time from the default settings', async () => {
    renderDetails();
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(t('recipeDetails.addToPlan')) }));

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipeDetails.today')) }));
    fireEvent.click(screen.getByRole('button', { name: 'Przekąska' }));
    const sheetButtons = screen.getAllByRole('button', { name: t('recipeDetails.addToPlan') });
    fireEvent.click(sheetButtons.at(-1)!);

    await waitFor(() => expect(mocks.addMeal).toHaveBeenCalledWith({
      recipe: { id: 'r1' },
      meal_date: todayIsoDate(),
      meal_type: 'snack1',
      portions_consumed: 1,
      measure_code: 'portion',
      measure_amount: null,
    }));
    expect(await screen.findByText(t('recipeDetails.addedToPlan'))).toBeTruthy();
  });

  it('offers only meal times that are visible in the profile', async () => {
    mocks.profile = { meal_config: [
      { id: 'breakfast', name: 'Śniadanie', visible: true },
      { id: 'supper', name: 'Kolacja', visible: false },
    ] };
    renderDetails();
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(t('recipeDetails.addToPlan')) }));

    expect(screen.getByRole('button', { name: 'Śniadanie' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kolacja' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipeDetails.otherDate')) }));
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.nextMonth') }));
    const firstOfNextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    fireEvent.click(screen.getByRole('button', { name: firstOfNextMonth.toLocaleDateString(t('recipeDetails.locale'), { day: 'numeric', month: 'long' }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Śniadanie' }));
    fireEvent.click(screen.getAllByRole('button', { name: t('recipeDetails.addToPlan') }).at(-1)!);

    await waitFor(() => expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({ meal_date: toIsoDate(firstOfNextMonth), meal_type: 'breakfast' })));
  });

  it('closes the meal time and date pickers when tapping outside them', async () => {
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast');
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    fireEvent.click(screen.getByRole('button', { name: /Dodajesz do: Śniadanie/ }));
    expect(screen.getByRole('button', { name: 'Kolacja' })).toBeTruthy();
    tapOutside();
    expect(screen.queryByRole('button', { name: 'Kolacja' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /17 października/ }));
    expect(screen.getByRole('button', { name: t('recipeDetails.nextMonth') })).toBeTruthy();
    tapOutside();
    expect(screen.queryByRole('button', { name: t('recipeDetails.nextMonth') })).toBeNull();
    expect(document.querySelector('[data-outside-press-layer]')).toBeNull();
  });

  it('adds the recipe for several days to the chosen meal time and date', async () => {
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast');
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    fireEvent.click(screen.getByRole('button', { name: /Dodajesz do: Śniadanie/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Kolacja' }));
    expect(screen.getByRole('button', { name: /Dodajesz do: Kolacja/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /17 października/ }));
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.nextMonth') }));
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.previousMonth') }));
    fireEvent.click(screen.getByRole('button', { name: '18 października' }));
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.moreDays') }));
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.moreDays') }));
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.fewerDays') }));
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.add') }));

    await screen.findByText('plan screen');
    expect(mocks.addMeal.mock.calls.map(call => [call[0].meal_date, call[0].meal_type])).toEqual([
      ['2026-10-18', 'supper'],
      ['2026-10-19', 'supper'],
    ]);
  });

  it('previews the day before and after adding the recipe', async () => {
    mocks.profile = { target_kcal: 2000, target_protein: 100, target_fat: 60, target_carbs: 250 };
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast');
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.show') }));
    expect(screen.getByText(t('dayBalance.afterTitle'))).toBeTruthy();
    expect(screen.getByText('1089')).toBeTruthy();
    expect(mocks.getConsumedForDay).toHaveBeenLastCalledWith('2026-10-17', null);

    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.before') }));
    expect(screen.getByText(t('dayBalance.beforeTitle'))).toBeTruthy();
    expect(screen.getByText('1000')).toBeTruthy();
  });

  it('shows the current day as the balance after opening a plan entry without changes', async () => {
    mocks.profile = { target_kcal: 2000, target_protein: 100, target_fat: 60, target_carbs: 250 };
    mocks.getConsumedForDay.mockImplementation((_date: string, excludedMealId: string | null) =>
      excludedMealId === 'm1' ? { kcal: 822, protein: 47.8, fat: 29.4, carbs: 54 } : { kcal: 1000, protein: 50, fat: 30, carbs: 100 });
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');
    await waitFor(() => expect((screen.getByLabelText(t('recipeDetails.gramsInput')) as HTMLInputElement).value).toBe('200'));

    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.show') }));
    expect(screen.getByText(t('dayBalance.afterEditTitle'))).toBeTruthy();
    expect(screen.getByText('1000')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.before') }));
    expect(screen.getByText('822')).toBeTruthy();
  });

  it('uses the saved portions of an unchanged plan entry when its grams were rounded', async () => {
    mocks.profile = { target_kcal: 2000, target_protein: 100, target_fat: 60, target_carbs: 250 };
    mocks.getRecipe.mockResolvedValue({
      ...OWN_RECIPE,
      kcal: 300,
      ingredients: [{ id: 'i1', name: 'Banan', amount: 150, unit: 'g', product: BANANA }],
    });
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 1, measure_code: 'g', measure_amount: null }]);
    mocks.getConsumedForDay.mockImplementation((_date: string, excludedMealId: string | null) =>
      excludedMealId === 'm1' ? { kcal: 700, protein: 40, fat: 20, carbs: 80 } : { kcal: 1000, protein: 41.1, fat: 20.3, carbs: 103 });
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');
    await waitFor(() => expect((screen.getByLabelText(t('recipeDetails.gramsInput')) as HTMLInputElement).value).toBe('38'));

    expect(screen.getByTestId('kcal-value').textContent).toBe('300');
    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.show') }));
    expect(screen.getByText('1000')).toBeTruthy();
  });

  it('skips the day preview when there are no nutrition targets', async () => {
    mocks.profile = null;
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast');
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    expect(screen.queryByRole('button', { name: t('dayBalance.show') })).toBeNull();
  });
});

describe('RecipeDetails add to plan sheet calendar', () => {
  it('picks a date from the calendar without choosing a quick day first', async () => {
    renderDetails();
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(t('recipeDetails.addToPlan')) }));

    const otherDate = screen.getByRole('button', { name: new RegExp(t('recipeDetails.otherDate')) });
    expect(otherDate.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(otherDate);
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    fireEvent.click(screen.getByRole('button', { name: lastDay.toLocaleDateString(t('recipeDetails.locale'), { day: 'numeric', month: 'long' }) }));

    expect(screen.queryByRole('button', { name: t('recipeDetails.nextMonth') })).toBeNull();
    expect(screen.getByText(lastDay.toLocaleDateString(t('recipeDetails.locale'), { weekday: 'long', day: 'numeric', month: 'long' }))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kolacja' }));
    fireEvent.click(screen.getAllByRole('button', { name: t('recipeDetails.addToPlan') }).at(-1)!);

    await waitFor(() => expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({ meal_date: toIsoDate(lastDay), meal_type: 'supper' })));
  });

  it('closes the calendar when tapped again', async () => {
    renderDetails();
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(t('recipeDetails.addToPlan')) }));
    const otherDate = screen.getByRole('button', { name: new RegExp(t('recipeDetails.otherDate')) });

    fireEvent.click(otherDate);
    expect(screen.getByRole('button', { name: t('recipeDetails.previousMonth') })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.previousMonth') }));
    fireEvent.click(otherDate);
    expect(screen.queryByRole('button', { name: t('recipeDetails.previousMonth') })).toBeNull();
  });
});

describe('RecipeDetails amount limits', () => {
  it('does not accept more than 50 portions or 5000 grams', async () => {
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast');
    const portions = await screen.findByLabelText(t('recipeDetails.portionsInput')) as HTMLInputElement;

    fireEvent.change(portions, { target: { value: '51' } });
    expect(portions.value).toBe('1');
    fireEvent.change(portions, { target: { value: '1.25' } });
    expect(portions.value).toBe('1');
    fireEvent.change(portions, { target: { value: '50' } });
    expect(portions.value).toBe('50');

    const grams = screen.getByLabelText(t('recipeDetails.gramsInput')) as HTMLInputElement;
    fireEvent.change(grams, { target: { value: '5001' } });
    expect(grams.value).toBe('100');
    expect(grams.getAttribute('autocomplete')).toBe('off');
    expect(grams.getAttribute('inputmode')).toBe('decimal');
  });

  it('keeps the largest values inside the cards and circles', async () => {
    mocks.getRecipe.mockResolvedValue({ ...OWN_RECIPE, kcal: 9000, protein: 900, fat: 400, carbs: 1000 });
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast');
    const portions = await screen.findByLabelText(t('recipeDetails.portionsInput'));

    fireEvent.change(portions, { target: { value: '50' } });

    expect(screen.getByTestId('portions-kcal').textContent).toBe('450 tys.');
    const kcal = screen.getByTestId('kcal-value');
    expect(kcal.textContent).toBe('450 tys.');
    expect(kcal.className).toContain('text-sm');
    const carbs = screen.getByTestId('carbs-value');
    expect(carbs.textContent).toBe('50 tys.g');
    expect(carbs.className).toContain('text-[10px]');
  });
});

describe('RecipeDetails small plan entry changes', () => {
  it('enables updating after a change smaller than one gram', async () => {
    renderDetails('/recipe/r1?selectDate=2026-10-17&selectType=breakfast&mealId=m1');
    await waitFor(() => expect((screen.getByLabelText(t('recipeDetails.gramsInput')) as HTMLInputElement).value).toBe('200'));
    const update = screen.getByRole('button', { name: t('recipeDetails.update') }) as HTMLButtonElement;

    fireEvent.change(screen.getByLabelText(t('recipeDetails.gramsInput')), { target: { value: '200.1' } });
    expect(update.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText(t('recipeDetails.gramsInput')), { target: { value: '200' } });
    expect(update.disabled).toBe(true);
  });
});

describe('RecipeDetails sheet calendar and quick days', () => {
  it('moves the calendar to the quick day chosen above it', async () => {
    renderDetails();
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(t('recipeDetails.addToPlan')) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipeDetails.otherDate')) }));
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.nextMonth') }));
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.nextMonth') }));

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('recipeDetails.today')) }));

    const today = new Date();
    const todayLabel = today.toLocaleDateString(t('recipeDetails.locale'), { day: 'numeric', month: 'long' });
    expect(screen.getByRole('button', { name: todayLabel }).getAttribute('aria-pressed')).toBe('true');
  });
});

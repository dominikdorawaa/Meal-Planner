import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RecipeDetails } from './RecipeDetails';
import { t } from '../i18n';
import { measure, withMeasures } from '../lib/measureFixtures';
import { addDaysToIsoDate, todayIsoDate } from '../lib/planDates';
import { fullDayLabel, shortDayLabel, weekStartOf } from '../lib/planTarget';

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
  prep_time: 15,
  own: true,
  saved: false,
  instructions: ['Pokrój banana', 'Wymieszaj'],
  ingredients: [{ id: 'i1', name: 'Banan', amount: 400, unit: 'g', product: BANANA }],
};
const BASE_RECIPE = { ...OWN_RECIPE, id: 'r2', name: 'Sałatka bazowa', own: false, saved: false, instructions: [], ingredients: [] };
const TARGETS = { target_kcal: 2000, target_protein: 100, target_fat: 60, target_carbs: 250 };
const PLAN_PATH = '/recipe/r1?selectDate=2026-10-17&selectType=breakfast';
const EDIT_PATH = `${PLAN_PATH}&mealId=m1`;

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

function amountInput(label: 'recipeDetails.portionsInput' | 'recipeDetails.gramsInput') {
  return screen.getByLabelText(t(label)) as HTMLInputElement;
}

function chooseUnit(unit: 'portion' | 'g') {
  fireEvent.change(screen.getByLabelText(t('amount.unit')), { target: { value: unit } });
}

function updateButton() {
  return screen.getByRole('button', { name: t('recipeDetails.update') }) as HTMLButtonElement;
}

function tapOutside() {
  fireEvent.click(screen.getByRole('dialog').parentElement!);
}

function balanceValue(key: string) {
  return screen.getByTestId(`balance-${key}`).textContent;
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

describe('RecipeDetails loading', () => {
  it('loads the recipe once and shows nutrition of one portion', async () => {
    renderDetails();

    expect(await screen.findByRole('heading', { name: 'Owsianka bananowa' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: t('recipeDetails.nutritionTitle') })).toBeTruthy();
    expect(screen.getByText('1 porcja · 100 g')).toBeTruthy();
    expect(screen.getByText(t('recipes.minutes', { count: 15 }))).toBeTruthy();
    expect(screen.getByText(`${t('recipeDetails.ingredientsFor', { portions: t('recipeDetails.portionsAccusative.few', { count: 4 }) })} · 400 g`)).toBeTruthy();
    expect(screen.getByText(t('recipeDetails.recipeFor', { portions: t('recipeDetails.portionsAccusative.few', { count: 4 }) }))).toBeTruthy();
    expect(screen.getByText('400 g')).toBeTruthy();
    expect(screen.getByText('Pokrój banana')).toBeTruthy();
    expect(screen.getByTestId('amount-kcal').textContent).toBe('89');
    expect(mocks.getRecipe).toHaveBeenCalledTimes(1);
  });

  it('shows no status message when the recipe opens', async () => {
    const { container } = renderDetails();

    expect(await screen.findByRole('heading', { name: 'Owsianka bananowa' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.textContent).not.toContain('check_circle');
  });

  it('shows step names above their text and wraps long links', async () => {
    const link = 'https://example.com/' + 'a'.repeat(120);
    mocks.getRecipe.mockResolvedValue({
      ...OWN_RECIPE,
      steps: [{ name: 'Sos', text: link }, { name: null, text: 'Wymieszaj' }, { name: 'Podanie', text: '' }],
    });
    renderDetails();

    const sauce = await screen.findByRole('heading', { name: 'Sos' });
    expect(sauce.nextElementSibling?.textContent).toBe(link);
    expect(sauce.nextElementSibling?.className).toContain('[overflow-wrap:anywhere]');
    expect(screen.getByText('Wymieszaj').className).toContain('[overflow-wrap:anywhere]');
    expect(screen.getByRole('heading', { name: 'Podanie' }).nextElementSibling).toBeNull();
    expect(screen.queryByText(t('recipeForm.step', { number: 2 }))).toBeNull();
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

  it('shows the nutrition of each ingredient in macro colors for the chosen portions', async () => {
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
    expect(within(banana).getByTestId('ingredient-kcal').textContent).toBe('356 kcal');
    expect(within(banana).getByText('4.4').parentElement?.className).toContain('text-macro-protein');
    expect(within(banana).getByText('1.2').parentElement?.className).toContain('text-macro-fat');
    expect(within(banana).getByText('92').parentElement?.className).toContain('text-macro-carbs');
    expect(within(honey).getByText(t('nutrients.noData'))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.morePortions') }));
    expect(within(screen.getAllByTestId('recipe-ingredient')[0]).getByTestId('ingredient-kcal').textContent).toBe('401 kcal');
  });

  it('opens one table per portion next to the rings, whatever amount is chosen', async () => {
    const banana = { ...BANANA, saturated_fat: 0.1, sugars: 12, fiber: 2.6, salt: 0 };
    mocks.getRecipe.mockResolvedValue({ ...OWN_RECIPE, ingredients: [{ ...OWN_RECIPE.ingredients[0], product: banana }] });
    renderDetails();
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.morePortions') }));
    const toggle = screen.getByRole('button', { name: t('nutrients.showTable') });
    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('columnheader', { name: t('nutrients.recipePortion') })).toBeTruthy();
    const cells = screen.getAllByRole('row').slice(1).map(row => within(row).getByRole('cell').textContent);
    expect(cells).toEqual(['89 kcal', '1.1 g', '0.3 g', '0.1 g', '23 g', '12 g', '2.6 g', '0 g']);

    fireEvent.click(screen.getByRole('button', { name: t('nutrients.hideTable') }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a dash for nutrients that an ingredient has no data for', async () => {
    mocks.getRecipe.mockResolvedValue({
      ...OWN_RECIPE,
      ingredients: [...OWN_RECIPE.ingredients, { id: 'i2', name: 'Miód', amount: 20, unit: 'g', product: null }],
    });
    renderDetails();

    fireEvent.click(await screen.findByRole('button', { name: t('nutrients.showTable') }));
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

    fireEvent.click(await screen.findByRole('button', { name: t('nutrients.showTable') }));
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

  it('recalculates calories for the typed weight after switching the unit to grams', async () => {
    renderDetails();
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    chooseUnit('g');
    fireEvent.change(amountInput('recipeDetails.gramsInput'), { target: { value: '200' } });

    expect(screen.getByTestId('amount-kcal').textContent).toBe('178');
    expect(screen.getByTestId('kcal-value').textContent).toBe('178');
  });

  it('scales the ingredients with the portion stepper', async () => {
    renderDetails();
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    expect(screen.queryByRole('button', { name: t('recipeDetails.wholeRecipe') })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.morePortions') }));
    expect(screen.getByText('450 g')).toBeTruthy();
    expect(screen.getByText(`${t('recipeDetails.ingredientsFor', { portions: t('recipeDetails.portionsAccusative.fraction', { count: 4.5 }) })} · 450 g`)).toBeTruthy();
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.fewerPortions') }));
    }
    expect(within(screen.getByTestId('recipe-ingredient')).getByText('50 g')).toBeTruthy();
    expect(screen.getByText(`0.5 ${t('recipeDetails.portionWord.fraction')}`)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.wholeRecipe') }));
    expect(screen.getByText('400 g')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t('recipeDetails.wholeRecipe') })).toBeNull();
  });

  it('offers calorie picks with their weight and uses the chosen one', async () => {
    renderDetails();
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    expect(screen.getByText(t('recipeDetails.kcalPicks'))).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /kcal, \d+ g$/ }).map(button => button.getAttribute('aria-label'))).toEqual([
      '45 kcal, 50 g', '89 kcal, 100 g', '134 kcal, 150 g', '178 kcal, 200 g',
    ]);
    const half = screen.getByRole('button', { name: '45 kcal, 50 g' });
    fireEvent.click(half);

    expect(half.getAttribute('aria-pressed')).toBe('true');
    expect(amountInput('recipeDetails.portionsInput').value).toBe('0.5');
    expect(screen.getByText('0.5 porcji · 50 g')).toBeTruthy();
    expect(screen.getByText('400 g')).toBeTruthy();

    fireEvent.change(amountInput('recipeDetails.portionsInput'), { target: { value: '2' } });
    expect(half.getAttribute('aria-pressed')).toBe('false');
  });

  it('carries a calorie pick over when switching units', async () => {
    renderDetails();
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    fireEvent.click(screen.getByRole('button', { name: '134 kcal, 150 g' }));
    chooseUnit('g');
    expect(amountInput('recipeDetails.gramsInput').value).toBe('150');
    chooseUnit('portion');

    expect(amountInput('recipeDetails.portionsInput').value).toBe('1.5');
    expect(screen.getByRole('button', { name: '134 kcal, 150 g' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('uses the plural form of portions in the calculator', async () => {
    renderDetails();
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    fireEvent.change(amountInput('recipeDetails.portionsInput'), { target: { value: '2' } });
    expect(screen.getByText(t('recipeDetails.portionWord.few'))).toBeTruthy();
    fireEvent.change(amountInput('recipeDetails.portionsInput'), { target: { value: '5' } });
    expect(screen.getByText(t('recipeDetails.portionWord.many'))).toBeTruthy();
  });

  it('shows a message with a way back when the recipe cannot be loaded', async () => {
    mocks.getRecipe.mockRejectedValue(new Error('Not found'));
    renderDetails();

    expect(await screen.findByText(t('recipeDetails.notFound'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('recipeDetails.back') }));
    expect(screen.getByText('recipes screen')).toBeTruthy();
  });
});

describe('RecipeDetails plan entries', () => {
  it('opens a plan entry added by weight with its grams and saves a changed amount', async () => {
    renderDetails(EDIT_PATH);

    await waitFor(() => expect(amountInput('recipeDetails.gramsInput').value).toBe('200'));
    expect((screen.getByLabelText(t('amount.unit')) as HTMLSelectElement).value).toBe('g');
    expect(updateButton().disabled).toBe(true);

    fireEvent.change(amountInput('recipeDetails.gramsInput'), { target: { value: '300' } });
    expect(updateButton().disabled).toBe(false);
    fireEvent.change(amountInput('recipeDetails.gramsInput'), { target: { value: '200' } });
    expect(updateButton().disabled).toBe(true);
    chooseUnit('portion');
    expect(amountInput('recipeDetails.portionsInput').value).toBe('2');
    fireEvent.change(amountInput('recipeDetails.portionsInput'), { target: { value: '3' } });
    fireEvent.click(updateButton());

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 3, measure_code: 'portion', measure_amount: null });
  });

  it('opens a plan entry added by portions in portions and carries the amount over to grams', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 2, measure_code: 'portion', measure_amount: null }]);
    renderDetails(EDIT_PATH);

    await waitFor(() => expect(amountInput('recipeDetails.portionsInput').value).toBe('2'));
    chooseUnit('g');
    expect(amountInput('recipeDetails.gramsInput').value).toBe('200');
    expect(updateButton().disabled).toBe(false);
    fireEvent.click(updateButton());

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 2, measure_code: 'g', measure_amount: 200 });
  });

  it('opens an older plan entry without a saved method in portions', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 2 }]);
    renderDetails(EDIT_PATH);

    await waitFor(() => expect(amountInput('recipeDetails.portionsInput').value).toBe('2'));
  });

  it('lets a plan entry switch to a calorie pick of the same amount', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 1, measure_code: 'portion', measure_amount: null }]);
    renderDetails(EDIT_PATH);
    await waitFor(() => expect(amountInput('recipeDetails.portionsInput').value).toBe('1'));
    expect(updateButton().disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '89 kcal, 100 g' }));
    expect(updateButton().disabled).toBe(false);
    fireEvent.click(updateButton());

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 1, measure_code: 'quick-pick', measure_amount: null });
  });

  it('calculates the grams again when the recipe weight changed after the entry was saved', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 2, measure_code: 'g', measure_amount: 150 }]);
    renderDetails(EDIT_PATH);

    await waitFor(() => expect(amountInput('recipeDetails.gramsInput').value).toBe('200'));
    expect(screen.getByTestId('kcal-value').textContent).toBe(screen.getByTestId('amount-kcal').textContent);
  });

  it('opens a plan entry added by a calorie pick with that pick highlighted', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 0.5, measure_code: 'quick-pick', measure_amount: null }]);
    renderDetails(EDIT_PATH);

    await waitFor(() => expect(screen.getByRole('button', { name: '45 kcal, 50 g' }).getAttribute('aria-pressed')).toBe('true'));
    expect(amountInput('recipeDetails.portionsInput').value).toBe('0.5');
    expect(updateButton().disabled).toBe(true);
  });

  it('saves how the amount was chosen when changing a plan entry by weight', async () => {
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 2, measure_code: 'portion', measure_amount: null }]);
    renderDetails(EDIT_PATH);
    await waitFor(() => expect(amountInput('recipeDetails.portionsInput').value).toBe('2'));

    chooseUnit('g');
    fireEvent.change(amountInput('recipeDetails.gramsInput'), { target: { value: '150' } });
    fireEvent.click(updateButton());

    await screen.findByText('plan screen');
    expect(mocks.updateMeal).toHaveBeenCalledWith('m1', { portions_consumed: 1.5, measure_code: 'g', measure_amount: 150 });
  });

  it('blocks updating a plan entry with an empty or zero amount', async () => {
    renderDetails(EDIT_PATH);
    await waitFor(() => expect(amountInput('recipeDetails.gramsInput').value).toBe('200'));

    fireEvent.change(amountInput('recipeDetails.gramsInput'), { target: { value: '0' } });
    expect(updateButton().disabled).toBe(true);
    fireEvent.change(amountInput('recipeDetails.gramsInput'), { target: { value: '' } });
    expect(updateButton().disabled).toBe(true);
  });

  it('enables updating after a change smaller than one gram', async () => {
    renderDetails(EDIT_PATH);
    await waitFor(() => expect(amountInput('recipeDetails.gramsInput').value).toBe('200'));

    fireEvent.change(amountInput('recipeDetails.gramsInput'), { target: { value: '200.1' } });
    expect(updateButton().disabled).toBe(false);
    fireEvent.change(amountInput('recipeDetails.gramsInput'), { target: { value: '200' } });
    expect(updateButton().disabled).toBe(true);
  });

  it('tells when a plan entry cannot be updated', async () => {
    mocks.updateMeal.mockRejectedValue(new Error('Server error'));
    renderDetails(EDIT_PATH);
    await waitFor(() => expect(amountInput('recipeDetails.gramsInput').value).toBe('200'));

    fireEvent.change(amountInput('recipeDetails.gramsInput'), { target: { value: '250' } });
    fireEvent.click(updateButton());

    expect(await screen.findByText(t('recipeDetails.updateFailed'))).toBeTruthy();
  });

  it('shows the meal and day only as information while editing', async () => {
    renderDetails(EDIT_PATH);
    const target = await screen.findByRole('button', { name: /Edytujesz w: Śniadanie, Sobota, 17\.10/ }) as HTMLButtonElement;

    expect(target.disabled).toBe(true);
    expect(target.textContent).not.toContain('expand_more');
  });
});

describe('RecipeDetails own recipe actions', () => {
  it('offers editing and deleting only in the menu of an own recipe', async () => {
    renderDetails();
    const menu = await openMenu();

    expect(menu.getByText('Owsianka bananowa')).toBeTruthy();
    expect(menu.getByText(`89 kcal · ${t('recipeDetails.recipeFor', { portions: t('recipeDetails.portionsAccusative.few', { count: 4 }) })}`)).toBeTruthy();
    expect(menu.getByText(t('recipeDelete.confirm')).closest('button')?.className).toContain('text-error');
    expect(menu.getByText(t('recipeDetails.edit')).closest('button')?.className).not.toContain('text-error');

    fireEvent.click(menu.getByText(t('recipeDetails.edit')));
    expect(screen.getByText('edit screen')).toBeTruthy();
  });

  it('lets the author save their own recipe with the heart on the photo', async () => {
    renderDetails();
    fireEvent.click(await screen.findByRole('button', { name: t('recipeDetails.save') }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('r1'));
    expect(screen.getByRole('button', { name: t('recipeDetails.menu') })).toBeTruthy();
  });

  it('closes the menu when tapping outside or the close button', async () => {
    renderDetails();
    await openMenu();

    tapOutside();
    expect(screen.queryByRole('dialog')).toBeNull();

    const menu = await openMenu();
    fireEvent.click(menu.getByRole('button', { name: t('plan.summary.close') }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('deletes the recipe after confirming in the sheet', async () => {
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
    expect(saved.className).toContain('text-saved');
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

describe('RecipeDetails adding to the plan from the recipe list', () => {
  async function openSheet() {
    fireEvent.click(await screen.findByRole('button', { name: t('recipeDetails.addToPlan') }));
    return within(screen.getByRole('dialog', { name: 'Owsianka bananowa' }));
  }

  it('adds the recipe for today to the chosen meal time', async () => {
    renderDetails();
    const sheet = await openSheet();
    const today = todayIsoDate();

    expect(sheet.getByRole('button', { name: fullDayLabel(today) }).getAttribute('aria-pressed')).toBe('true');
    expect(sheet.getByText('1 porcja · 100 g · 89 kcal')).toBeTruthy();
    const confirm = sheet.getByRole('button', { name: t('planTarget.chooseMeal') }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.click(sheet.getByRole('button', { name: 'Przekąska' }));
    fireEvent.click(sheet.getByRole('button', { name: `${t('planTarget.addTo.snack1')}, ${shortDayLabel(today)}` }));

    await waitFor(() => expect(mocks.addMeal).toHaveBeenCalledWith({
      recipe: { id: 'r1' },
      meal_date: today,
      meal_type: 'snack1',
      portions_consumed: 1,
      measure_code: 'portion',
      measure_amount: null,
    }));
    expect((await screen.findByRole('status')).textContent).toContain(t('recipeDetails.addedToPlan'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers only visible meal times and moves between weeks', async () => {
    mocks.profile = { meal_config: [
      { id: 'breakfast', name: 'Śniadanie', visible: true },
      { id: 'supper', name: 'Kolacja', visible: false },
      { id: 'gym', name: 'Po treningu', visible: true },
    ] };
    renderDetails();
    const sheet = await openSheet();

    expect(sheet.getByRole('button', { name: 'Śniadanie' })).toBeTruthy();
    expect(sheet.queryByRole('button', { name: 'Kolacja' })).toBeNull();

    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.nextWeek') }));
    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.nextWeek') }));
    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.previousWeek') }));
    const nextMonday = addDaysToIsoDate(weekStartOf(todayIsoDate()), 7);
    fireEvent.click(sheet.getByRole('button', { name: fullDayLabel(nextMonday) }));
    fireEvent.click(sheet.getByRole('button', { name: 'Po treningu' }));
    fireEvent.click(sheet.getByRole('button', { name: `${t('planTarget.addToNamed', { meal: 'Po treningu' })}, ${shortDayLabel(nextMonday)}` }));

    await waitFor(() => expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({ meal_date: nextMonday, meal_type: 'gym' })));
  });

  it('shows how the chosen day would change when there are targets', async () => {
    mocks.profile = TARGETS;
    renderDetails();
    const sheet = await openSheet();

    fireEvent.click(sheet.getByRole('button', { name: t('dayBalance.title') }));
    expect(balanceValue('kcal')).toBe('1089');
    expect(mocks.getConsumedForDay).toHaveBeenCalledWith(todayIsoDate(), null);
  });

  it('closes the sheet when tapping outside it', async () => {
    renderDetails();
    await openSheet();

    tapOutside();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.addMeal).not.toHaveBeenCalled();
  });
});

describe('RecipeDetails adding from the plan', () => {
  it('changes the meal time and day in one sheet and adds there', async () => {
    renderDetails(PLAN_PATH);
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    fireEvent.click(screen.getByRole('button', { name: /Śniadanie, Sobota, 17\.10\. Zmień porę lub dzień/ }));
    const sheet = within(screen.getByRole('dialog', { name: t('planTarget.whereTitle') }));
    expect(sheet.getByRole('button', { name: 'Śniadanie' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(sheet.getByRole('button', { name: 'Kolacja' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Niedziela, 18.10' }));
    fireEvent.click(sheet.getByRole('button', { name: t('planTarget.set', { meal: 'Kolacja', day: 'nd 18.10' }) }));

    expect(screen.getByRole('button', { name: /Kolacja, Niedziela, 18\.10/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('planTarget.addTo.supper') }));

    await screen.findByText('plan screen');
    expect(mocks.addMeal).toHaveBeenCalledTimes(1);
    expect(mocks.addMeal).toHaveBeenCalledWith(expect.objectContaining({ meal_date: '2026-10-18', meal_type: 'supper' }));
  });

  it('keeps the meal and day when the sheet is closed', async () => {
    renderDetails(PLAN_PATH);
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    fireEvent.click(screen.getByRole('button', { name: /Zmień porę lub dzień/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Kolacja' }));
    fireEvent.click(screen.getByRole('button', { name: t('plan.summary.close') }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: t('planTarget.addTo.breakfast') })).toBeTruthy();
  });

  it('compares the day before and after adding the recipe', async () => {
    mocks.profile = TARGETS;
    renderDetails(PLAN_PATH);
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    const toggle = screen.getByRole('button', { name: t('dayBalance.title') });
    expect(screen.getByText(t('dayBalance.subtitle'))).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(balanceValue('kcal')).toBe('1089');
    expect(mocks.getConsumedForDay).toHaveBeenLastCalledWith('2026-10-17', null);

    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.before') }));
    expect(balanceValue('kcal')).toBe('1000');
  });

  it('shows the current day as the balance after opening a plan entry without changes', async () => {
    mocks.profile = TARGETS;
    mocks.getConsumedForDay.mockImplementation((_date: string, excludedMealId: string | null) =>
      excludedMealId === 'm1' ? { kcal: 822, protein: 47.8, fat: 29.4, carbs: 54 } : { kcal: 1000, protein: 50, fat: 30, carbs: 100 });
    renderDetails(EDIT_PATH);
    await waitFor(() => expect(amountInput('recipeDetails.gramsInput').value).toBe('200'));

    expect(screen.getByText(t('dayBalance.editSubtitle'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.title') }));
    expect(balanceValue('kcal')).toBe('1000');

    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.before') }));
    expect(balanceValue('kcal')).toBe('822');
  });

  it('uses the saved portions of an unchanged plan entry when its grams were rounded', async () => {
    mocks.profile = TARGETS;
    mocks.getRecipe.mockResolvedValue({
      ...OWN_RECIPE,
      kcal: 300,
      ingredients: [{ id: 'i1', name: 'Banan', amount: 150, unit: 'g', product: BANANA }],
    });
    mocks.getAllMeals.mockResolvedValue([{ id: 'm1', portions_consumed: 1, measure_code: 'g', measure_amount: null }]);
    mocks.getConsumedForDay.mockImplementation((_date: string, excludedMealId: string | null) =>
      excludedMealId === 'm1' ? { kcal: 700, protein: 40, fat: 20, carbs: 80 } : { kcal: 1000, protein: 41.1, fat: 20.3, carbs: 103 });
    renderDetails(EDIT_PATH);
    await waitFor(() => expect(amountInput('recipeDetails.gramsInput').value).toBe('38'));

    expect(screen.getByTestId('kcal-value').textContent).toBe('300');
    fireEvent.click(screen.getByRole('button', { name: t('dayBalance.title') }));
    expect(balanceValue('kcal')).toBe('1000');
  });

  it('skips the day comparison when there are no nutrition targets', async () => {
    mocks.profile = null;
    renderDetails(PLAN_PATH);
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    expect(screen.queryByRole('button', { name: t('dayBalance.title') })).toBeNull();
  });
});

describe('RecipeDetails amount limits', () => {
  it('does not accept more than 50 portions or 5000 grams', async () => {
    renderDetails(PLAN_PATH);
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });
    const portions = amountInput('recipeDetails.portionsInput');

    fireEvent.change(portions, { target: { value: '51' } });
    expect(portions.value).toBe('1');
    fireEvent.change(portions, { target: { value: '1.25' } });
    expect(portions.value).toBe('1');
    fireEvent.change(portions, { target: { value: '50' } });
    expect(portions.value).toBe('50');

    chooseUnit('g');
    const grams = amountInput('recipeDetails.gramsInput');
    expect(grams.value).toBe('5000');
    fireEvent.change(grams, { target: { value: '5001' } });
    expect(grams.value).toBe('5000');
    expect(grams.getAttribute('autocomplete')).toBe('off');
    expect(grams.getAttribute('inputmode')).toBe('decimal');
  });

  it('keeps the largest values inside the field and circles', async () => {
    mocks.getRecipe.mockResolvedValue({ ...OWN_RECIPE, kcal: 9000, protein: 900, fat: 400, carbs: 1000 });
    renderDetails(PLAN_PATH);
    await screen.findByRole('heading', { name: 'Owsianka bananowa' });

    fireEvent.change(amountInput('recipeDetails.portionsInput'), { target: { value: '50' } });

    expect(screen.getByTestId('amount-kcal').textContent).toBe('450 tys.');
    const kcal = screen.getByTestId('kcal-value');
    expect(kcal.textContent).toBe('450 tys.');
    expect(kcal.className).toContain('text-sm');
    const carbs = screen.getByTestId('carbs-value');
    expect(carbs.textContent).toBe('50 tys.g');
    expect(carbs.className).toContain('text-[10px]');
  });
});

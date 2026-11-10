import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../lib/AppDataContext';
import { api, ApiError, type Product } from '../lib/apiClient';
import { useBarcodeLookup } from '../lib/useBarcodeLookup';
import { missingProductMessage } from '../lib/barcodeLookup';
import {
  ingredientAmountLabel,
  ingredientMacros,
  ingredientsWithoutProduct,
  recipeMacrosPerPortion,
  type IngredientDraft,
  type IngredientQuantity,
} from '../lib/recipeIngredient';
import { BarcodeLookupPending } from '../components/BarcodeLookupPending';
import { LazyBarcodeScanner } from '../components/LazyBarcodeScanner';
import { IngredientSearch } from '../components/IngredientSearch';
import { IngredientAmountScreen } from '../components/IngredientAmountScreen';
import { NewProductSheet, type NewProductDraft } from '../components/NewProductSheet';
import { t } from '../i18n';
import { useCloseOnBack } from '../lib/backNavigation';
import { RecipePhotoSheet } from '../components/RecipePhotoSheet';
import { RecipePhotoFocusSheet } from '../components/RecipePhotoFocusSheet';
import {
  imagePosition,
  makeMainImage,
  MAX_RECIPE_IMAGES,
  newRecipeImage,
  recipeImages,
  type RecipeImage,
} from '../lib/recipeImage';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { RecipeStepsEditor } from '../components/RecipeStepsEditor';
import { newStepDraft, stepTitle, stepsOfRecipe, stepsPayload, type RecipeStepDraft } from '../lib/recipeSteps';
import { resizeRecipePhoto } from '../lib/recipePhoto';
import { formatCompactNumber } from '../lib/compactNumber';
import { AMOUNT_LIMITS, RECIPE_LIMITS, acceptsLimitedNumber, isPositiveWithinLimit, numberFieldProps } from '../lib/inputLimits';

interface AmountTarget {
  product: Product;
  index: number | null;
}

interface RecipeDraft {
  name: string;
  prepTime: string;
  portions: string;
  images: RecipeImage[];
  ingredients: IngredientDraft[];
  instructions: RecipeStepDraft[];
}

function draftSnapshot(draft: RecipeDraft): string {
  return JSON.stringify([
    draft.name,
    draft.prepTime,
    draft.portions,
    draft.images.map(({ url, focus_x, focus_y }) => [url, focus_x, focus_y]),
    draft.ingredients.map(({ name, amount, unit, product }) => [name, amount, unit, product?.id ?? null]),
    draft.instructions.map(step => [step.name, step.text]),
  ]);
}

const EMPTY_DRAFT: RecipeDraft = { name: '', prepTime: '', portions: '', images: [], ingredients: [], instructions: [] };

export default function AddRecipe() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const { user, refreshRecipes } = useAppData();

  const [name, setName] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [portions, setPortions] = useState('');
  const [images, setImages] = useState<RecipeImage[]>([]);

  const [baseMacros, setBaseMacros] = useState({ kcal: 0, p: 0, f: 0, c: 0 });

  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [instructions, setInstructions] = useState<RecipeStepDraft[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(() => (isEditMode ? null : draftSnapshot(EMPTY_DRAFT)));

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);
  const [productTarget, setProductTarget] = useState<number | null>(null);
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null);
  const [newProduct, setNewProduct] = useState<NewProductDraft | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<number | null>(null);
  const [ingredientToDelete, setIngredientToDelete] = useState<number | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [editedImage, setEditedImage] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isUploadingPhoto = uploadingCount > 0;
  const missingProducts = ingredientsWithoutProduct(ingredients).length > 0;
  const hasUnsavedChanges = savedSnapshot !== null
    && draftSnapshot({ name, prepTime, portions, images, ingredients, instructions }) !== savedSnapshot;

  const closeIngredientSearch = () => {
    setShowIngredientSearch(false);
    setProductTarget(null);
  };

  useCloseOnBack(hasUnsavedChanges && !showLeaveConfirm && !isSaving && !isUploadingPhoto, () => setShowLeaveConfirm(true));
  useCloseOnBack(showIngredientSearch, closeIngredientSearch);
  useCloseOnBack(amountTarget !== null, () => setAmountTarget(null));

  useEffect(() => {
    async function loadEditData() {
      if (!isEditMode || !id) return;

      try {
        const recipe = await api.recipes.getById(id);
        if (!recipe || recipe.own === false) {
          navigate(recipe ? `/recipe/${id}` : '/recipes', { replace: true });
          return;
        }

        const loaded: RecipeDraft = {
          name: recipe.name,
          prepTime: recipe.prep_time ? recipe.prep_time.toString() : '',
          portions: recipe.portions ? recipe.portions.toString() : '1',
          images: recipeImages(recipe),
          instructions: stepsOfRecipe(recipe).map(step => newStepDraft(step)),
          ingredients: (recipe.ingredients ?? []).map((ingredient: IngredientDraft) => ({
            id: ingredient.id,
            name: ingredient.name,
            amount: Number(ingredient.amount),
            unit: ingredient.unit,
            product: ingredient.product ?? null,
          })),
        };
        setName(loaded.name);
        setPrepTime(loaded.prepTime);
        setPortions(loaded.portions);
        setImages(loaded.images);
        setInstructions(loaded.instructions);
        setIngredients(loaded.ingredients);
        setBaseMacros({ kcal: recipe.kcal, p: recipe.protein, f: recipe.fat, c: recipe.carbs });
        setSavedSnapshot(draftSnapshot(loaded));
        const firstWithoutProduct = loaded.ingredients.findIndex(ingredient => !ingredient.product);
        if (firstWithoutProduct >= 0) {
          setProductTarget(firstWithoutProduct);
          setShowIngredientSearch(true);
        }
      } catch (err) {
        console.error('Error loading recipe:', err);
        navigate('/recipes', { replace: true });
      } finally {
        setIsLoading(false);
      }
    }
    loadEditData();
  }, [id, isEditMode, navigate]);

  const openAmount = (product: Product) => setAmountTarget({ product, index: productTarget });

  const chooseProductFor = (index: number) => {
    setProductTarget(index);
    setShowIngredientSearch(true);
  };

  const chooseCreatedOrExistingProduct = (product: Product) => {
    setNewProduct(null);
    openAmount(product);
  };

  const handleAmountSubmit = ({ amount, unit }: IngredientQuantity) => {
    if (!amountTarget) return;
    const { product, index } = amountTarget;
    if (index === null) {
      setIngredients(previous => [...previous, { product, name: product.name, amount, unit }]);
    } else {
      setIngredients(previous => previous.map((ingredient, i) => (
        i !== index ? ingredient
          : ingredient.product ? { ...ingredient, amount, unit }
          : { ...ingredient, product, name: product.name, amount, unit }
      )));
    }
    setAmountTarget(null);
    closeIngredientSearch();
  };

  const barcodeLookup = useBarcodeLookup();

  const handleBarCode = (barCode: string) => {
    setShowScanner(false);
    barcodeLookup.lookUp(barCode, {
      onFound: openAmount,
      onMissing: prefill => setNewProduct({ barCode, prefill, message: t(missingProductMessage(prefill), { code: barCode }) }),
      onError: () => alert(t('scanner.lookupFailed')),
    });
  };

  const handlePhotosPicked = async (files: File[]) => {
    setShowPhotoSheet(false);
    const accepted = files.slice(0, Math.max(0, MAX_RECIPE_IMAGES - images.length));
    setPhotoError(accepted.length < files.length ? t('recipeForm.photoLimit', { count: MAX_RECIPE_IMAGES }) : null);
    setUploadingCount(accepted.length);
    for (const file of accepted) {
      try {
        const url = await api.recipes.uploadImage(await resizeRecipePhoto(file));
        setImages(current => (current.length < MAX_RECIPE_IMAGES ? [...current, newRecipeImage(url)] : current));
      } catch (err) {
        console.error('Error uploading recipe photo:', err);
        setPhotoError(err instanceof ApiError ? err.message : t('recipeForm.photoFailed'));
      } finally {
        setUploadingCount(count => count - 1);
      }
    }
  };

  const removeImage = (index: number) => {
    setPhotoError(null);
    setEditedImage(null);
    setImages(current => current.filter((_, i) => i !== index));
  };

  const replaceImage = (index: number, image: RecipeImage) =>
    images.map((current, i) => (i === index ? image : current));

  const handleClose = () => {
    if (hasUnsavedChanges) setShowLeaveConfirm(true);
    else navigate(-1);
  };

  const handleSaveRecipe = async () => {
    if (!user || !name.trim() || isUploadingPhoto || missingProducts) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const portionCount = parseFloat(portions) || 1;
      const calculated = recipeMacrosPerPortion(ingredients, portionCount);

      const recipePayload = {
        name: name.trim(),
        kcal: calculated.kcal > 0 ? calculated.kcal : baseMacros.kcal,
        protein: calculated.protein > 0 ? calculated.protein : baseMacros.p,
        fat: calculated.fat > 0 ? calculated.fat : baseMacros.f,
        carbs: calculated.carbs > 0 ? calculated.carbs : baseMacros.c,
        images,
        prep_time: parseInt(prepTime) || 0,
        portions: portionCount,
        ...stepsPayload(instructions),
        ingredients: ingredients.map(ing => ({
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          product: { id: ing.product?.id }
        }))
      };

      if (isEditMode && id) {
        await api.recipes.update(id, recipePayload);
      } else {
        await api.recipes.create(recipePayload);
      }

      await refreshRecipes();
      navigate(-1);
    } catch (err) {
      setSaveError(t('recipeForm.saveFailed', { message: err instanceof Error ? err.message : '' }));
      setIsSaving(false);
    }
  };

  const handleAddStep = () => {
    setInstructions([...instructions, newStepDraft()]);
  };

  const handleDeleteStepConfirm = (index: number) => {
    const newInst = [...instructions];
    newInst.splice(index, 1);
    setInstructions(newInst);
    setStepToDelete(null);
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col">
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/10 px-4 py-3 pt-safe-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleClose} aria-label={t('recipe.close')} className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform">
            <span className="material-symbols-outlined">close</span>
          </button>
          <h1 className="font-headline font-bold text-lg text-on-surface">{t(isEditMode ? 'recipeForm.editTitle' : 'recipeForm.newTitle')}</h1>
        </div>
        <button
          onClick={handleSaveRecipe}
          disabled={!name.trim() || isSaving || isUploadingPhoto || missingProducts || (portions.trim() !== '' && !isPositiveWithinLimit(portions, AMOUNT_LIMITS.portion))}
          className="px-5 py-2 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 shadow-sm"
        >
          {isSaving ? t('recipeForm.saving') : t('recipeForm.save')}
        </button>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-6 flex flex-col gap-8">
        {saveError && (
          <p role="alert" className="text-sm font-bold text-error bg-error/10 rounded-2xl px-4 py-3">{saveError}</p>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        )}
        <section className="flex flex-col gap-2">
          {images.length === 0 && uploadingCount === 0 ? (
            <button
              type="button"
              onClick={() => setShowPhotoSheet(true)}
              aria-label={t('recipeForm.photoAdd')}
              className="w-full aspect-[4/3] bg-surface-container-low rounded-[32px] border border-outline-variant/20 border-dashed flex flex-col items-center justify-center hover:bg-surface-container-lowest transition-colors active:scale-[0.98] group overflow-hidden relative"
            >
              <span className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
              </span>
              <span className="font-bold text-sm text-on-surface-variant">{t('recipeForm.photoAdd')}</span>
              <span className="text-xs text-on-surface-variant/70 mt-1">{t('recipeForm.photoLimitHint', { count: MAX_RECIPE_IMAGES })}</span>
            </button>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {images.map((image, index) => (
                  <div key={image.url} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-surface-container-highest">
                    <button
                      type="button"
                      onClick={() => setEditedImage(index)}
                      aria-label={t('recipeForm.photoEdit', { index: index + 1 })}
                      className="absolute inset-0 w-full h-full active:scale-[0.97] transition-transform"
                    >
                      <img src={image.url} alt="" className="w-full h-full object-cover" style={{ objectPosition: imagePosition(image) }} />
                    </button>
                    {index === 0 ? (
                      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none">
                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        {t('recipeForm.photoMain')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setImages(current => makeMainImage(current, index))}
                        aria-label={t('recipeForm.photoMakeMain', { index: index + 1 })}
                        className="absolute top-1 left-1 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white active:scale-90 transition-transform"
                      >
                        <span className="material-symbols-outlined text-[18px]">star</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label={t('recipeForm.photoRemove', { index: index + 1 })}
                      className="absolute top-1 right-1 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white active:scale-90 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ))}
                {Array.from({ length: uploadingCount }, (_, index) => (
                  <div key={`uploading-${index}`} className="aspect-[4/3] rounded-2xl bg-surface-container-low flex flex-col items-center justify-center gap-1.5">
                    <span className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-on-surface-variant text-center px-1">{t('recipeForm.photoUploading')}</span>
                  </div>
                ))}
                {images.length + uploadingCount < MAX_RECIPE_IMAGES && (
                  <button
                    type="button"
                    onClick={() => setShowPhotoSheet(true)}
                    disabled={isUploadingPhoto}
                    aria-label={t('recipeForm.photoAdd')}
                    className="aspect-[4/3] rounded-2xl bg-surface-container-low border border-outline-variant/20 border-dashed flex flex-col items-center justify-center gap-1 text-primary active:scale-[0.97] transition-transform disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                    <span className="text-[10px] font-bold text-on-surface-variant">{images.length + uploadingCount}/{MAX_RECIPE_IMAGES}</span>
                  </button>
                )}
              </div>
              {images.length > 0 && <p className="text-xs text-on-surface-variant pl-1">{t('recipeForm.photoHint')}</p>}
            </>
          )}
          {photoError && <p role="alert" className="text-sm font-bold text-error pl-1">{photoError}</p>}
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="recipe-name" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant pl-1">{t('recipeForm.name')}</label>
            <input
              autoComplete="off"
              id="recipe-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-headline font-bold text-xl transition-shadow placeholder:font-medium placeholder:text-on-surface-variant/40"
              placeholder={t('recipeForm.namePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="recipe-prep-time" className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pl-1">{t('recipeForm.prepTime')}</label>
              <div className="relative flex items-center bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
                <input
                  id="recipe-prep-time"
                  {...numberFieldProps(RECIPE_LIMITS.prepMinutes, 0)}
                  value={prepTime}
                  onChange={e => acceptsLimitedNumber(e.target.value, RECIPE_LIMITS.prepMinutes, 0) && setPrepTime(e.target.value)}
                  className="w-full bg-transparent py-3.5 pl-4 pr-12 outline-none text-on-surface font-bold text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="absolute right-4 text-xs font-bold text-on-surface-variant">min</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="recipe-portions" className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pl-1">{t('recipeForm.portions')}</label>
              <div className="relative flex items-center bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
                <input
                  id="recipe-portions"
                  {...numberFieldProps(AMOUNT_LIMITS.portion)}
                  value={portions}
                  onChange={e => acceptsLimitedNumber(e.target.value, AMOUNT_LIMITS.portion) && setPortions(e.target.value)}
                  className="w-full bg-transparent py-3.5 pl-4 pr-16 outline-none text-on-surface font-bold text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="1"
                />
                <span className="absolute right-4 text-xs font-bold text-on-surface-variant whitespace-nowrap">{t('recipeForm.portionsUnit')}</span>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-t border-outline-variant/10" />

        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface pl-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[16px]">kitchen</span>
            {t('recipeForm.ingredients')}
          </h2>

          <div className="flex flex-col gap-3">
            {ingredients.length === 0 && (
              <p className="text-sm font-medium text-on-surface-variant/70 pl-1">{t('recipeForm.noIngredients')}</p>
            )}

            {missingProducts && (
              <p role="alert" className="text-sm font-bold text-error bg-error/10 rounded-2xl px-4 py-3">{t('recipeForm.productsMissing')}</p>
            )}

            {ingredients.map((ing, idx) => {
              const kcal = ingredientMacros(ing).kcal;
              const product = ing.product;
              return (
                <div key={ing.id ?? idx} className="flex items-center gap-1 bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10 shadow-sm">
                  <button
                    type="button"
                    onClick={() => (product ? setAmountTarget({ product, index: idx }) : chooseProductFor(idx))}
                    aria-label={t(product ? 'recipeIngredients.edit' : 'recipeForm.chooseProduct', { name: ing.name })}
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
                  >
                    <span className="flex flex-col flex-1 min-w-0 pr-2">
                      <span className="font-bold text-sm text-on-surface truncate">{ing.name}</span>
                      {!product && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-error mt-0.5">
                          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">error</span>
                          <span className="truncate">{t('recipeForm.chooseProduct', { name: ing.name })}</span>
                        </span>
                      )}
                      {kcal > 0 && <span className="text-[10px] font-bold text-primary mt-0.5 truncate">{formatCompactNumber(kcal)} kcal</span>}
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-lg shrink-0">
                      {ingredientAmountLabel(ing)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIngredientToDelete(idx)}
                    aria-label={t('recipeForm.removeIngredient', { name: ing.name })}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowIngredientSearch(true)}
            className="w-full py-4 bg-surface-container-low text-on-surface font-bold text-sm rounded-2xl hover:bg-surface-container transition-colors active:scale-[0.98] border border-outline-variant/20 flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            {t('recipeForm.addIngredient')}
          </button>
        </section>

        <hr className="border-t border-outline-variant/10" />

        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface pl-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[16px]">format_list_numbered</span>
            {t('recipeForm.steps')}
          </h2>

          <RecipeStepsEditor steps={instructions} onChange={setInstructions} onRemove={setStepToDelete} />

          <button
            type="button"
            onClick={handleAddStep}
            className="w-full py-4 bg-surface-container-low text-on-surface font-bold text-sm rounded-2xl hover:bg-surface-container transition-colors active:scale-[0.98] border border-outline-variant/20 flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            {t('recipeForm.addStep')}
          </button>
        </section>
      </main>

      {showIngredientSearch && (
        <IngredientSearch
          key={productTarget ?? 'new'}
          initialQuery={productTarget === null ? '' : ingredients[productTarget]?.name}
          prompt={productTarget === null ? undefined : t('recipeIngredients.chooseFor', { name: ingredients[productTarget]?.name ?? '' })}
          onClose={closeIngredientSearch}
          onSelect={openAmount}
          onAddProduct={productName => setNewProduct({ name: productName })}
          onScan={() => setShowScanner(true)}
        />
      )}

      {amountTarget && (
        <IngredientAmountScreen
          key={`${amountTarget.product.id}-${amountTarget.index}`}
          product={amountTarget.product}
          initial={amountTarget.index === null ? undefined : ingredients[amountTarget.index]}
          submitLabel={t(amountTarget.index === null ? 'recipeIngredients.add' : 'recipeIngredients.save')}
          onSubmit={handleAmountSubmit}
          onBack={() => setAmountTarget(null)}
        />
      )}

      {newProduct && (
        <NewProductSheet
          key={newProduct.barCode ?? newProduct.name ?? 'manual'}
          draft={newProduct}
          onClose={() => setNewProduct(null)}
          onCreated={chooseCreatedOrExistingProduct}
          existingProductAction={{ onOpen: chooseCreatedOrExistingProduct }}
        />
      )}

      {showLeaveConfirm && (
        <ConfirmSheet
          question={t('recipe.leaveTitle')}
          title={name.trim() || t('recipe.leaveNewName')}
          description={t('recipe.leaveText')}
          confirmLabel={t('recipe.leaveDiscard')}
          cancelLabel={t('recipe.leaveStay')}
          onConfirm={() => navigate(-1)}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}

      {stepToDelete !== null && (
        <ConfirmSheet
          question={t('recipeForm.removeStepTitle')}
          title={stepTitle(instructions[stepToDelete] ?? { name: null }, stepToDelete)}
          detail={instructions[stepToDelete]?.text.trim() || undefined}
          description={t('recipeForm.removeStepText')}
          confirmLabel={t('recipeForm.removeStepConfirm')}
          onConfirm={() => handleDeleteStepConfirm(stepToDelete)}
          onCancel={() => setStepToDelete(null)}
        />
      )}

      {ingredientToDelete !== null && (
        <ConfirmSheet
          question={t('recipeForm.removeIngredientTitle')}
          title={ingredients[ingredientToDelete]?.name ?? ''}
          description={t('recipeForm.removeIngredientText')}
          confirmLabel={t('recipeForm.removeIngredientConfirm')}
          onConfirm={() => {
            setIngredients(ingredients.filter((_, i) => i !== ingredientToDelete));
            setIngredientToDelete(null);
          }}
          onCancel={() => setIngredientToDelete(null)}
        />
      )}

      {showPhotoSheet && (
        <RecipePhotoSheet onPick={handlePhotosPicked} onClose={() => setShowPhotoSheet(false)} />
      )}

      {editedImage !== null && images[editedImage] && (
        <RecipePhotoFocusSheet
          key={images[editedImage].url}
          image={images[editedImage]}
          isMain={editedImage === 0}
          onDone={image => {
            setImages(replaceImage(editedImage, image));
            setEditedImage(null);
          }}
          onMakeMain={image => {
            setImages(makeMainImage(replaceImage(editedImage, image), editedImage));
            setEditedImage(null);
          }}
          onRemove={() => removeImage(editedImage)}
          onClose={() => setEditedImage(null)}
        />
      )}

      {showScanner && <LazyBarcodeScanner onDetected={handleBarCode} onClose={() => setShowScanner(false)} />}
      {barcodeLookup.pending && <BarcodeLookupPending onCancel={barcodeLookup.cancel} />}
    </div>
  );
}

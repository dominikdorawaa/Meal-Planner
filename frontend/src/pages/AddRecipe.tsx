import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../lib/AppDataContext';
import { api, type Product } from '../lib/apiClient';
import { useBarcodeLookup } from '../lib/useBarcodeLookup';
import { missingProductMessage } from '../lib/barcodeLookup';
import {
  ingredientAmountLabel,
  ingredientMacros,
  recipeMacros,
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

interface InstructionStep {
  text: string;
}

interface AmountTarget {
  product: Product;
  index: number | null;
}

interface RecipeDraft {
  name: string;
  prepTime: string;
  portions: string;
  imageUrl: string;
  ingredients: IngredientDraft[];
  instructions: InstructionStep[];
}

function draftSnapshot(draft: RecipeDraft): string {
  return JSON.stringify([
    draft.name,
    draft.prepTime,
    draft.portions,
    draft.imageUrl,
    draft.ingredients.map(({ name, amount, unit, product }) => [name, amount, unit, product?.id ?? null]),
    draft.instructions.map(step => step.text),
  ]);
}

const EMPTY_DRAFT: RecipeDraft = { name: '', prepTime: '', portions: '', imageUrl: '', ingredients: [], instructions: [] };

export default function AddRecipe() {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const { user, refreshRecipes } = useAppData();

  const [name, setName] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [portions, setPortions] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [baseMacros, setBaseMacros] = useState({ kcal: 0, p: 0, f: 0, c: 0 });

  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [instructions, setInstructions] = useState<InstructionStep[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(() => (isEditMode ? null : draftSnapshot(EMPTY_DRAFT)));

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null);
  const [newProduct, setNewProduct] = useState<NewProductDraft | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<number | null>(null);
  const [ingredientToDelete, setIngredientToDelete] = useState<number | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const hasUnsavedChanges = savedSnapshot !== null
    && draftSnapshot({ name, prepTime, portions, imageUrl, ingredients, instructions }) !== savedSnapshot;

  useCloseOnBack(hasUnsavedChanges && !showLeaveConfirm && !isSaving, () => setShowLeaveConfirm(true));
  useCloseOnBack(showLeaveConfirm, () => setShowLeaveConfirm(false));
  useCloseOnBack(showIngredientSearch, () => setShowIngredientSearch(false));
  useCloseOnBack(amountTarget !== null, () => setAmountTarget(null));
  useCloseOnBack(stepToDelete !== null, () => setStepToDelete(null));
  useCloseOnBack(ingredientToDelete !== null, () => setIngredientToDelete(null));

  useEffect(() => {
    async function loadEditData() {
      if (!isEditMode || !id) return;

      try {
        const recipe = await api.recipes.getById(id);
        if (!recipe) {
           navigate(-1);
           return;
        }

        const loaded: RecipeDraft = {
          name: recipe.name,
          prepTime: recipe.prep_time ? recipe.prep_time.toString() : '',
          portions: recipe.portions ? recipe.portions.toString() : '1',
          imageUrl: recipe.image_url || '',
          instructions: Array.isArray(recipe.instructions) ? recipe.instructions.map((step: string) => ({ text: step })) : [],
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
        setImageUrl(loaded.imageUrl);
        setInstructions(loaded.instructions);
        setIngredients(loaded.ingredients);
        setBaseMacros({ kcal: recipe.kcal, p: recipe.protein, f: recipe.fat, c: recipe.carbs });
        setSavedSnapshot(draftSnapshot(loaded));
      } catch (err) {
        console.error("Error loading recipe:", err);
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    }
    loadEditData();
  }, [id, isEditMode, navigate]);

  const openAmount = (product: Product) => setAmountTarget({ product, index: null });

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
      setIngredients(previous => previous.map((ingredient, i) => (i === index ? { ...ingredient, amount, unit } : ingredient)));
    }
    setAmountTarget(null);
    setShowIngredientSearch(false);
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

  const handleClose = () => {
    if (hasUnsavedChanges) setShowLeaveConfirm(true);
    else navigate(-1);
  };

  const handleSaveRecipe = async () => {
    if (!user || !name) return;
    setIsSaving(true);

    try {
      const calculated = recipeMacros(ingredients);

      const recipePayload = {
        name,
        kcal: calculated.kcal > 0 ? calculated.kcal : baseMacros.kcal,
        protein: calculated.protein > 0 ? calculated.protein : baseMacros.p,
        fat: calculated.fat > 0 ? calculated.fat : baseMacros.f,
        carbs: calculated.carbs > 0 ? calculated.carbs : baseMacros.c,
        image_url: imageUrl.trim() || null,
        prep_time: parseInt(prepTime) || 0,
        portions: parseFloat(portions) || 1,
        instructions: instructions.map(i => i.text),
        ingredients: ingredients.map(ing => ({
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
          product: ing.product ? { id: ing.product.id } : null
        }))
      };

      if (isEditMode && id) {
        await api.recipes.update(id, recipePayload);
      } else {
        await api.recipes.create(recipePayload);
      }

      await refreshRecipes();
      navigate(-1);
    } catch (err: any) {
      alert("Błąd zapisu przepisu: " + err.message);
      setIsSaving(false);
    }
  };

  const handleAddStep = () => {
    setInstructions([...instructions, { text: '' }]);
  };

  const handleUpdateStep = (index: number, text: string) => {
    setInstructions(instructions.map((step, i) => (i === index ? { text } : step)));
  };

  const handleDeleteStepConfirm = (index: number) => {
    const newInst = [...instructions];
    newInst.splice(index, 1);
    setInstructions(newInst);
    setStepToDelete(null);
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen pb-32 flex flex-col">
      
      {/* HEADER */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/10 px-4 py-3 pt-safe-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleClose} aria-label={t('recipe.close')} className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center text-on-surface-variant active:scale-95 transition-transform">
            <span className="material-symbols-outlined">close</span>
          </button>
          <h1 className="font-headline font-bold text-lg text-on-surface">{isEditMode ? 'Edycja przepisu' : 'Nowy Przepis'}</h1>
        </div>
        <button 
          onClick={handleSaveRecipe}
          disabled={!name || isSaving}
          className="px-5 py-2 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 shadow-sm"
        >
          {isSaving ? 'Zapisywanie...' : 'Zapisz'}
        </button>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-6 flex flex-col gap-8">
        
        {isLoading && (
          <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* IMAGE SECTION */}
        <section className="w-full aspect-[4/3] bg-surface-container-low rounded-[32px] border border-outline-variant/20 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-lowest transition-colors active:scale-[0.98] group overflow-hidden relative">
          {imageUrl ? (
             <img src={imageUrl} alt="Podgląd" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
              </div>
              <p className="font-bold text-sm text-on-surface-variant">Prześlij z urządzenia</p>
            </>
          )}
        </section>

        {/* BASIC INFO */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant pl-1">Nazwa Przepisu</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl py-4 px-5 outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-headline font-bold text-xl transition-shadow placeholder:font-medium placeholder:text-on-surface-variant/40"
              placeholder="np. Owsianka z malinami"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Czas przygotowania */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pl-1">Czas przygotowania</label>
              <div className="relative flex items-center bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
                <input
                  type="number"
                  min="0"
                  value={prepTime}
                  onChange={e => setPrepTime(e.target.value)}
                  className="w-full bg-transparent py-3.5 pl-4 pr-12 outline-none text-on-surface font-bold text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="absolute right-4 text-xs font-bold text-on-surface-variant">min</span>
              </div>
            </div>

            {/* Porcje */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant pl-1">Ilość porcji</label>
              <div className="relative flex items-center bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
                <input
                  type="number"
                  min="1"
                  value={portions}
                  onChange={e => setPortions(e.target.value)}
                  className="w-full bg-transparent py-3.5 pl-4 pr-20 outline-none text-on-surface font-bold text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="1"
                />
                <span className="absolute right-4 text-xs font-bold text-on-surface-variant whitespace-nowrap">x porcja</span>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-t border-outline-variant/10" />

        {/* INGREDIENTS */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface pl-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[16px]">kitchen</span>
            Składniki
          </h2>
          
          <div className="flex flex-col gap-3">
            {ingredients.length === 0 && (
              <p className="text-sm font-medium text-on-surface-variant/50 pl-1">Brak składników. Przynajmniej jeden jest wymagany.</p>
            )}

            {ingredients.map((ing, idx) => {
              const kcal = ingredientMacros(ing).kcal;
              const product = ing.product;
              return (
                <div key={ing.id ?? idx} className="flex items-center gap-1 bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10 shadow-sm">
                  <button
                    type="button"
                    disabled={!product}
                    onClick={() => product && setAmountTarget({ product, index: idx })}
                    aria-label={t('recipeIngredients.edit', { name: ing.name })}
                    className="flex flex-1 min-w-0 items-center gap-3 text-left disabled:cursor-default"
                  >
                    <span className="flex flex-col flex-1 min-w-0 pr-2">
                      <span className="font-bold text-sm text-on-surface truncate">{ing.name}</span>
                      {kcal > 0 && <span className="text-[10px] font-bold text-primary mt-0.5">{kcal} kcal</span>}
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container-highest px-3 py-1 rounded-lg shrink-0">
                      {ingredientAmountLabel(ing)}
                    </span>
                  </button>
                  <button
                    onClick={() => setIngredientToDelete(idx)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              );
            })}
          </div>

          <button 
            onClick={() => setShowIngredientSearch(true)}
            className="w-full py-4 bg-surface-container-low text-on-surface font-bold text-sm rounded-2xl hover:bg-surface-container transition-colors active:scale-[0.98] border border-outline-variant/20 flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Dodaj składnik
          </button>
        </section>

        <hr className="border-t border-outline-variant/10" />

        {/* INSTRUCTIONS */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface pl-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[16px]">format_list_numbered</span>
            Instrukcje
          </h2>

          <div className="flex flex-col gap-4">
            {instructions.map((step, idx) => (
              <div key={idx} className="flex gap-3 items-start group relative">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant font-black text-xs flex items-center justify-center shrink-0 mt-1">
                  {idx + 1}
                </div>
                <div className="flex-1 relative">
                  <textarea
                    value={step.text}
                    onChange={(e) => handleUpdateStep(idx, e.target.value)}
                    placeholder={`Krok ${idx + 1}...`}
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 pr-12 min-h-[100px] outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-medium text-sm transition-shadow resize-y"
                  />
                  <button 
                    onClick={() => setStepToDelete(idx)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant/50 hover:text-error hover:bg-error/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleAddStep}
            className="w-full py-4 bg-surface-container-low text-on-surface font-bold text-sm rounded-2xl hover:bg-surface-container transition-colors active:scale-[0.98] border border-outline-variant/20 flex items-center justify-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Dodaj krok
          </button>
        </section>
      </main>

      {showIngredientSearch && (
        <IngredientSearch
          onClose={() => setShowIngredientSearch(false)}
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
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowLeaveConfirm(false)}>
          <div role="alertdialog" aria-labelledby="leave-recipe-title" className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-[320px] w-full border border-outline-variant/20 text-center animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 id="leave-recipe-title" className="font-headline font-bold text-lg text-on-surface mb-2">{t('recipe.leaveTitle')}</h3>
            <p className="text-on-surface-variant text-sm font-medium mb-6">{t('recipe.leaveText')}</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-highest rounded-xl transition-colors active:scale-95"
              >
                {t('recipe.leaveStay')}
              </button>
              <button
                onClick={() => navigate(-1)}
                className="flex-[1.5] py-3 text-sm font-bold text-on-error bg-error rounded-xl shadow-sm hover:bg-error/90 transition-colors active:scale-95"
              >
                {t('recipe.leaveDiscard')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE STEP CONFIRMATION MODAL */}
      {stepToDelete !== null && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setStepToDelete(null)}>
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-[300px] w-full border border-outline-variant/20 text-center animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">delete</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface mb-2">Usunąć krok?</h3>
            <p className="text-on-surface-variant text-sm font-medium mb-6">Czy na pewno chcesz usunąć krok {stepToDelete + 1} ze swojego przepisu?</p>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => setStepToDelete(null)}
                className="flex-1 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-highest rounded-xl transition-colors active:scale-95"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleDeleteStepConfirm(stepToDelete)}
                className="flex-[1.5] py-3 text-sm font-bold text-on-error bg-error rounded-xl shadow-sm hover:bg-error/90 transition-colors active:scale-95"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE INGREDIENT CONFIRMATION MODAL */}
      {ingredientToDelete !== null && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIngredientToDelete(null)}>
          <div className="bg-surface-container-lowest rounded-[2rem] p-6 shadow-ambient max-w-[300px] w-full border border-outline-variant/20 text-center animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">delete</span>
            </div>
            <h3 className="font-headline font-bold text-lg text-on-surface mb-2">Usunąć składnik?</h3>
            <p className="text-on-surface-variant text-sm font-medium mb-6">Czy na pewno chcesz wyrzucić <br/><b className="text-on-surface">{ingredients[ingredientToDelete]?.name}</b><br/>z tego przepisu?</p>

            <div className="flex gap-3 w-full">
              <button
                onClick={() => setIngredientToDelete(null)}
                className="flex-1 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-highest rounded-xl transition-colors active:scale-95"
              >
                Anuluj
              </button>
              <button
                onClick={() => {
                  setIngredients(ingredients.filter((_, i) => i !== ingredientToDelete));
                  setIngredientToDelete(null);
                }}
                className="flex-[1.5] py-3 text-sm font-bold text-on-error bg-error rounded-xl shadow-sm hover:bg-error/90 transition-colors active:scale-95"
              >
                Usuń
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && <LazyBarcodeScanner onDetected={handleBarCode} onClose={() => setShowScanner(false)} />}
      {barcodeLookup.pending && <BarcodeLookupPending onCancel={barcodeLookup.cancel} />}
    </div>
  );
}

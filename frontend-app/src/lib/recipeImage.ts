/**
 * Tagi Flickr (Lorem Flickr) dopasowywane do nazwy — zapasowe zdjęcie jest tematyczne, nie losowe.
 * Kolejność reguł ma znaczenie przy remisach; pozycja w nazwie decyduje o kolejności tagów w URL.
 */
const KEYWORD_TAGS: { re: RegExp; tag: string }[] = [
  { re: /scrambled|jajeczn/i, tag: 'eggs' },
  { re: /smoothie|koktajl/i, tag: 'smoothie' },
  { re: /pesto/i, tag: 'pesto' },
  { re: /sourdough/i, tag: 'bread' },
  { re: /salmon|łosoś/i, tag: 'salmon' },
  { re: /kurczak|chicken/i, tag: 'chicken' },
  { re: /sałatk|salad/i, tag: 'salad' },
  { re: /quinoa|komos/i, tag: 'quinoa' },
  { re: /makaron|pasta/i, tag: 'pasta' },
  { re: /\bavo\b|avocado|awokad/i, tag: 'avocado' },
  { re: /chleb|bread|bułk/i, tag: 'bread' },
  { re: /jagod|truskawk|malin|berry|berries/i, tag: 'berries' },
  { re: /\bjaj(?:ka|ko|eczko)?\b|eggs?/i, tag: 'eggs' },
  { re: /zupa|soup/i, tag: 'soup' },
  { re: /pizza/i, tag: 'pizza' },
  { re: /burger/i, tag: 'burger' },
  { re: /ryż|risotto|\brice\b/i, tag: 'rice' },
  { re: /tofu/i, tag: 'tofu' },
  { re: /tuńczyk|krewet|dorsz|\bfish\b/i, tag: 'seafood' },
  { re: /steak|bifsztek|wołow/i, tag: 'steak' },
  { re: /curry/i, tag: 'curry' },
  { re: /tacos?|burrito/i, tag: 'mexican' },
  { re: /ramen|noodle/i, tag: 'noodles' },
  { re: /\bbowl\b/i, tag: 'bowl' },
  { re: /lasagne|lasagna/i, tag: 'lasagna' },
  { re: /tortill|wrap/i, tag: 'wrap' },
  { re: /pancake|naleśnik/i, tag: 'pancakes' },
  { re: /cookie|ciastk/i, tag: 'cookies' },
  { re: /cake|ciasto|tort\b/i, tag: 'cake' },
];

function tagsFromRecipeName(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'food,cooking';

  const hits: { tag: string; index: number }[] = [];
  for (const { re, tag } of KEYWORD_TAGS) {
    const m = re.exec(trimmed);
    if (m != null && m.index !== undefined && !hits.some(h => h.tag === tag)) {
      hits.push({ tag, index: m.index });
    }
  }

  hits.sort((a, b) => a.index - b.index);
  const tags = hits.slice(0, 2).map(h => h.tag);

  if (tags.length === 0) return 'food,cooking';
  if (tags.length === 1) return `${tags[0]},meal`;
  return `${tags[0]},${tags[1]}`;
}

/** Stabilny numer ?lock= dla Lorem Flickr (ten sam przepis → ta sama grafika zapasowa). */
function recipeImageLock(recipe: { id?: string; name?: string }): number {
  const s = String(recipe.id ?? recipe.name ?? 'x');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 4999) + 1;
}

/** Zapasowy URL: zdjęcie z Flickr wg tagów z nazwy przepisu. */
export function recipeImageFallbackUrl(recipe: { id?: string; name?: string }): string {
  const tagPath = tagsFromRecipeName(recipe.name || '');
  const lock = recipeImageLock(recipe);
  return `https://loremflickr.com/800/533/${tagPath}?lock=${lock}`;
}

/** Gdy nie ma jeszcze nazwy — ogólne jedzenie. */
export const DEFAULT_RECIPE_IMAGE_URL = 'https://loremflickr.com/800/533/food,cooking?lock=1';

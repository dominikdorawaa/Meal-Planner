---
name: Calendories
description: Planer posiłków z kaloriami i makro, projektowany najpierw na telefon, domyślnie w ciemnym motywie.
colors:
  surface: "#0a0a0a"
  surface-container-lowest: "#181818"
  surface-container-low: "#131313"
  surface-container: "#1c1c1c"
  surface-container-high: "#242424"
  surface-container-highest: "#2e2e2e"
  primary: "#9fd49a"
  primary-container: "#7fbf7a"
  on-primary: "#0d3a14"
  on-surface: "#e8e8e8"
  on-surface-variant: "#b8b8b8"
  error: "#ffb4ab"
  today: "#9fd49a"
  on-today: "#0d3a14"
  macro-protein: "#818cf8"
  macro-fat: "#fbbf24"
  macro-carbs: "#34d399"
  light-surface: "#f8faf7"
  light-surface-container-lowest: "#ffffff"
  light-primary: "#00342b"
  light-on-surface: "#00342b"
  light-on-surface-variant: "#3f4945"
  light-error: "#ba1a1a"
  light-macro-protein: "#4f46e5"
  light-macro-fat: "#f59e0b"
  light-macro-carbs: "#10b981"
  brand-navy: "#16233a"
  brand-plate: "#eef1ec"
  brand-leaf: "#9fd49a"
  meal-1: "#f2b84b"
  meal-2: "#7fc77a"
  meal-3: "#a78bfa"
  meal-4: "#60a5fa"
  meal-5: "#f472b6"
  meal-6: "#2dd4bf"
typography:
  headline:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontWeight: 800
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, sans-serif"
    fontWeight: 400
  day-kcal:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "clamp(17px, 5.6vw, 21px)"
    fontWeight: 800
    lineHeight: 1
  day-label:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "12.5px"
    fontWeight: 800
  meal-label:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 800
  macro-value:
    fontFamily: "Inter, sans-serif"
    fontSize: "9.5px"
    fontWeight: 700
rounded:
  card: "16px"
  day: "22px"
  sheet: "28px"
  pill: "9999px"
spacing:
  day-column: "33.3333vw"
  day-column-wide: "150px"
  column-gutter: "8px"
  today-band-inset: "3px"
components:
  day-strip-today:
    backgroundColor: "{colors.today}"
    textColor: "{colors.on-today}"
    rounded: "{rounded.pill}"
    size: "30px"
  day-strip-visible-days:
    backgroundColor: "{colors.surface-container-high}"
    rounded: "{rounded.card}"
  day-header-open:
    backgroundColor: "{colors.surface-container-lowest}"
    rounded: "{rounded.day}"
  meal-card-photo:
    backgroundColor: "{colors.surface-container-lowest}"
    rounded: "{rounded.card}"
  add-field:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.card}"
  add-field-today:
    textColor: "{colors.primary}"
    rounded: "{rounded.card}"
  day-summary-sheet:
    backgroundColor: "{colors.surface-container-low}"
    rounded: "{rounded.sheet}"
  app-icon:
    backgroundColor: "{colors.brand-navy}"
    textColor: "{colors.brand-plate}"
---

# Calendories

## Overview

Calendories to planer posiłków na telefon: plan dnia z kaloriami i makroskładnikami, przepisy, produkty i lista zakupów. Interfejs ma pomagać szybko odpowiedzieć na dwa pytania: co jem w kolejne dni i ile mi jeszcze zostało. Domyślny jest ciemny motyw, a jasny używa tych samych ról kolorów z innymi wartościami (tokeny z prefiksem `light-`). Charakter jest spokojny i rzeczowy, z jednym zielonym akcentem i kolorami makro jako jedynym miejscem na żywsze barwy.

Nazwa łączy kalendarz i kalorie, ale produkt to planowanie jedzenia, nie kalendarz. Projekt świadomie unika siatek i kartek z kalendarza tam, gdzie mogłyby wzmacniać to skojarzenie.

## Colors

- `surface` to tło całej aplikacji. Karty i pola leżą na kolejnych poziomach `surface-container-*`, coraz jaśniejszych w ciemnym motywie.
- `primary` (zieleń) to jedyny akcent: aktywne elementy, wartości w normie, dzisiejszy dzień. `today` ma tę samą wartość i jest używany do wyróżnienia dzisiaj w pasku dni, w nagłówkach i w kolumnie planu.
- `error` oznacza przekroczenie celu: liczby kalorii i makro powyżej zakresu oraz napis „za dużo”.
- Makro mają stałe kolory w całej aplikacji: białko `macro-protein`, tłuszcz `macro-fat`, węglowodany `macro-carbs`. Kalorie zawsze w `primary`.
- Pory dnia mają kropki w kolorach `meal-1` do `meal-6`, przypisane według kolejności posiłku w profilu, nie jego nazwy, żeby działały też dla posiłków nazwanych przez użytkownika.
- Ikona aplikacji ma własną paletę marki: granatowe tło `brand-navy`, jasne talerze `brand-plate` i zielony liść `brand-leaf`. Granat występuje tylko w ikonie, interfejs zostaje w zieleni.

## Typography

- Nagłówki, liczby i nazwy: Plus Jakarta Sans, grubość 800, lekko ściśnięte (`tracking-tight`).
- Tekst, etykiety i drobne wartości: Inter.
- Liczby, które stoją obok siebie w kolumnach (kalorie, makro, kcal w kartach), używają cyfr tabelarycznych.
- Długie wartości zmniejszają się stopniowo zamiast się ucinać (`fitTextClass` w `src/lib/fitText.ts`).
- Napis „Calendories” to wordmark: „Cal” i „ories” w grubości 800, „end” w 400, w tym samym kolorze (`src/components/Wordmark.tsx`). Używany tylko tam, gdzie nazwa działa jak logo (logowanie, nagłówek listy zakupów), a w zwykłym tekście zostaje zwykłym słowem.

## Layout

Zakładka Plan od góry:

1. Tytuł „Plan”, a obok nazwa miesiąca, widoczna tylko gdy w pasku nie ma dzisiejszego dnia.
2. Pasek dni: zawsze siedem dni na szerokość ekranu. Przesuwanie palcem przeskakuje o pełne 7 dni do przodu albo wstecz. Trzy dni widoczne w planie podświetla jeden płynnie przesuwany element. Pasek sam dosuwa się tak, żeby te trzy dni były zawsze w całości widoczne. Dotknięcie dnia przewija plan.
3. Plan: trzy kolumny dni na szerokość ekranu (`day-column`, od `sm` 150 px), przewijane w bok, posiłki przewijane w dół. W pamięci jest 21 dni, a przy krawędzi plan dokłada kolejny tydzień w obie strony, więc przewijanie nie ma końca. Gdy dzisiejszy dzień jest poza ekranem, pojawia się pływający przycisk „Dziś”.
4. Nagłówki dni, a pod nimi cienka linia przez całą szerokość.
5. Rzędy posiłków. Nazwa posiłku jest jedna dla wszystkich dni i zostaje przypięta do lewej krawędzi przy przewijaniu w bok. Komórki w rzędzie mają wspólną wysokość, a wolne miejsce wypełnia pole dodawania.

Dzisiejsza kolumna ma pas z gradientem: 11% zieleni u góry, 5% przy 30% wysokości, 3,5% na dole. Pas jest odsunięty o 3 px od ścianki ekranu, a karty siedzą w nim z 5 px marginesu. Podświetlenie trzech dni w pasku dni jest odsunięte o 4 px od brzegów.

Suwaki przewijania są ukryte w całej aplikacji.

## Elevation & Depth

Głębię buduje jasność tła, nie cienie: kolejne poziomy `surface-container-*`. Cień `shadow-ambient` mają tylko elementy pływające nad treścią: arkusz podsumowania dnia, przycisk „Dziś” i dolny pasek nawigacji. Kafelki z tłem w nagłówkach dni się nie pojawiają, wyjątkiem jest nagłówek dnia z otwartym podsumowaniem.

## Shapes

- Karty i zdjęcia posiłków: zaokrąglenie 16 px (`rounded-2xl`), zdjęcia zawsze kwadratowe.
- Nagłówki dni, pas dzisiejszego dnia, podświetlony nagłówek: 22 px.
- Arkusz od dołu: 28 px na górnych rogach.
- Pastylki, kółka dat i przyciski ikon: w pełni zaokrąglone.
- Ikona aplikacji: litera C ułożona z sześciu talerzy, z liściem w prawym górnym rogu, na granatowym tle. Ten sam liść, z ciemnym obrysem, oznacza dzień, w którym plan spełnia cel.

## Components

**Pasek dni** (`src/components/PlanWeekStrip.tsx`). Skrót dnia tygodnia nad numerem. Dzisiaj ma numer w wypełnionym zielonym kółku. Dzień spełniający cel ma liść wyrastający z prawego górnego rogu kółka numeru, bez dodatkowej wysokości. Cel jest spełniony, gdy kalorie mieszczą się w 5% od celu i żadne makro nie przekracza swojego zakresu (`isDayGoalMet` w `src/lib/daySummary.ts`).

**Nagłówek dnia.** Bez tła. W pierwszej linii skrót dnia z numerem („Pt 12”), a dla dzisiaj samo „Dziś” w zieleni, plus „⋯” z menu dnia po prawej. Pod spodem podsumowanie (`src/components/DaySummary.tsx`): duża liczba kalorii z dopiskiem „kcal”, pod nią „z 2100”, pasek kalorii i trzy wiersze B, T, W. Każdy wiersz ma etykietę, pasek i wartość z celem w kolumnie o stałej szerokości, dzięki czemu paski mają równą długość we wszystkich dniach. Nagłówek pokazuje ile jest w planie, nigdy ile brakuje.

**Podsumowanie dnia.** Dotknięcie nagłówka otwiera arkusz od dołu i podświetla nagłówek tego dnia szarym tłem. Arkusz ma tytuł z dniem i datą („Środa, 11.11”) oraz przycisk zamknięcia. Każdy wiersz: kolorowa kropka, nazwa, wartość z celem („72 / 120 g”), pasek i stan: „brakuje 48 g” w zieleni, „51 g za dużo” w kolorze `error` albo „W celu”. Zamyka się krzyżykiem, przesunięciem w dół, dotknięciem obok i klawiszem Escape.

**Nazwa posiłku.** Kolorowa kropka pory dnia z jasną poświatą, obok nazwa. Bez ikon.

**Karta pozycji.** Kwadratowe zdjęcie z przyciskiem „⋯” w rogu, pod nim nazwa w maksymalnie dwóch liniach i kalorie. Bez makro na karcie. Pozycje bez zdjęcia mają placeholder: zdjęcie przepisu domyślne dla motywu, produkt z ikoną owocu, szybki posiłek z błyskawicą.

**Pole dodawania.** Wypełnia całe wolne miejsce w komórce: ciemne tło, cienka przerywana ramka, okrągły plus i napis „Dodaj” w pustym posiłku albo „Dodaj więcej” pod pozycjami. W dzisiejszej kolumnie w zieleni. W trybie kopiowania pokazuje „Wklej” i zaznaczenie.

**Menu posiłku i dnia** (`src/components/PlanActionSheet.tsx`). Arkusz od dołu jak podsumowanie dnia, z krzyżykiem w prawym górnym rogu zamiast przycisku „Anuluj”. Na górze kontekst zamiast dużego tytułu: miniatura pozycji albo kafelek z numerem dnia (dzisiaj w zieleni), nazwa i jedna linia z porą dnia, datą i kaloriami. Akcje to zwykłe wiersze z szarą ikoną, pogrupowane cienkimi liniami. Kolor ma tylko akcja usuwania (`error`).

**Potwierdzenie z cofnięciem** (`src/components/UndoSnackbar.tsx`). Ciemna pastylka `surface-container-highest` nad dolnym paskiem. Gdy można cofnąć, ma zielony ptaszek, krótki tekst i strzałkę cofania otoczoną pierścieniem, który znika przez czas wyświetlania. Usunięcie posiłku z planu pokazuje „Usunięto z planu” przez 3 sekundy.

**Dolny pasek nawigacji.** Pływająca, zaokrąglona pastylka z rozmytym tłem. Nie jest częścią redesignu planu.

## Do's and Don'ts

- Pokazuj w nagłówku dnia ile jest w planie, a ile brakuje albo ile jest za dużo dopiero w podsumowaniu po dotknięciu.
- Trzymaj kolory makro i kropek pór dnia stałe w całej aplikacji.
- Wyróżniaj dzisiejszy dzień zielenią i pasem z gradientem, nie ramkami ani kilkoma obwódkami naraz.
- Nie dodawaj ikon przy nazwach posiłków ani tła pod nagłówkami dni.
- Nie używaj siatek i kartek kalendarza jako motywu graficznego.
- Nie pokazuj suwaków przewijania i nie pozwalaj, żeby elementy dotykały bocznych krawędzi ekranu.
- Nie zmniejszaj tekstu poniżej czytelności, żeby coś zmieścić. Lepiej skrócić, jak w nazwach dni.

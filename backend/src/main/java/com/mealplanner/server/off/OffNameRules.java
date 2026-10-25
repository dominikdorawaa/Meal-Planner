package com.mealplanner.server.off;

import com.mealplanner.server.product.NutritionRounding;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class OffNameRules {

    static final int MIN_NAME_LETTERS = 3;
    static final String POLISH_LETTERS = "ąćęłńóśźż";
    static final String FOREIGN_LETTERS_WITHOUT_ACCENT = "ßıøæœđþð";
    static final String DAIRIES_CATEGORY = "en:dairies";
    static final int MAX_WORDS_WITH_FOREIGN_LETTERS = 1;
    static final Set<String> FOREIGN_WORDS = words("foreign-words.txt");
    static final Set<String> POLISH_WORDS = words("polish-words.txt");
    static final Set<String> ALLOWED_FOREIGN_WORDS = words("allowed-foreign-words.txt");
    static final Set<String> JUNK_NAMES = words("junk-names.txt");
    static final Set<String> FAT_PERCENT_CATEGORIES = words("fat-percent-categories.txt");
    static final Set<String> FAT_PERCENT_NAME_WORDS = words("fat-percent-name-words.txt");

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern DECIMAL_PERCENT = Pattern.compile("(\\d+)[.,](\\d+)\\s*%");
    private static final Pattern SPACED_PERCENT = Pattern.compile("(\\d)\\s+%");
    private static final Pattern NOT_LETTER = Pattern.compile("[^\\p{L}]+");

    private OffNameRules() {
    }

    public static boolean isJunkName(String name) {
        long letters = name.codePoints().filter(Character::isLetter).count();
        String normalized = name.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N} ]", " ").trim()
                .replaceAll(" +", " ");
        return letters < MIN_NAME_LETTERS || JUNK_NAMES.contains(normalized);
    }

    public static boolean isForeignName(String name) {
        String lowerCase = name.toLowerCase(Locale.ROOT);
        List<String> words = Arrays.asList(NOT_LETTER.split(lowerCase));
        boolean hasPolishLetter = lowerCase.chars().anyMatch(letter -> POLISH_LETTERS.indexOf(letter) >= 0);
        boolean hasNonLatinLetter = lowerCase.codePoints().filter(Character::isLetter)
                .anyMatch(letter -> Character.UnicodeScript.of(letter) != Character.UnicodeScript.LATIN);
        long wordsWithForeignLetters = words.stream().filter(word -> !ALLOWED_FOREIGN_WORDS.contains(word))
                .filter(OffNameRules::hasForeignLetter).count();
        boolean looksForeign = wordsWithForeignLetters > 0 || words.stream().anyMatch(FOREIGN_WORDS::contains);
        return hasNonLatinLetter || wordsWithForeignLetters > MAX_WORDS_WITH_FOREIGN_LETTERS || looksForeign
                && !hasPolishLetter
                && words.stream().noneMatch(POLISH_WORDS::contains);
    }

    public static String normalize(String name) {
        String text = WHITESPACE.matcher(name).replaceAll(" ").trim();
        text = DECIMAL_PERCENT.matcher(text).replaceAll("$1,$2%");
        text = SPACED_PERCENT.matcher(text).replaceAll("$1%");
        return isShouted(text) ? capitalized(text.toLowerCase(Locale.ROOT)) : text;
    }

    public static String withFatPercent(String name, Double fat, Collection<String> categories) {
        if (name.isEmpty() || fat == null || name.contains("%")) {
            return name;
        }
        boolean dairyName = Arrays.stream(NOT_LETTER.split(name.toLowerCase(Locale.ROOT)))
                .filter(word -> !word.isEmpty())
                .findFirst().filter(FAT_PERCENT_NAME_WORDS::contains).isPresent();
        boolean fatDefinesProduct = categories.stream().anyMatch(FAT_PERCENT_CATEGORIES::contains)
                || dairyName && (categories.isEmpty() || categories.contains(DAIRIES_CATEGORY));
        return fatDefinesProduct ? name + " " + percent(fat) : name;
    }

    private static boolean hasForeignLetter(String word) {
        return word.codePoints()
                .filter(letter -> POLISH_LETTERS.indexOf(letter) < 0)
                .anyMatch(letter -> FOREIGN_LETTERS_WITHOUT_ACCENT.indexOf(letter) >= 0
                        || Normalizer.normalize(Character.toString(letter), Normalizer.Form.NFD).length() > 1);
    }

    private static boolean isShouted(String text) {
        long letters = text.codePoints().filter(Character::isLetter).count();
        return letters >= MIN_NAME_LETTERS && text.codePoints().noneMatch(Character::isLowerCase);
    }

    private static String capitalized(String text) {
        int index = 0;
        while (index < text.length() && !Character.isLetter(text.codePointAt(index))) {
            index += Character.charCount(text.codePointAt(index));
        }
        if (index == text.length()) {
            return text;
        }
        int next = index + Character.charCount(text.codePointAt(index));
        return text.substring(0, index) + text.substring(index, next).toUpperCase(Locale.ROOT) + text.substring(next);
    }

    private static String percent(double fat) {
        return BigDecimal.valueOf(NutritionRounding.grams(fat)).stripTrailingZeros().toPlainString()
                .replace('.', ',') + "%";
    }

    private static Set<String> words(String file) {
        try (InputStream input = Objects.requireNonNull(OffNameRules.class.getResourceAsStream("/off/" + file),
                "Missing word list " + file)) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8).lines()
                    .map(line -> line.trim().toLowerCase(Locale.ROOT))
                    .filter(line -> !line.isEmpty())
                    .collect(Collectors.toUnmodifiableSet());
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}

package com.mealplanner.server.product;

import java.util.Set;

public final class BarCodes {

    private static final Set<Integer> SUPPORTED_LENGTHS = Set.of(8, 12, 13);

    private BarCodes() {
    }

    public static boolean isValid(String barCode) {
        if (barCode == null || !SUPPORTED_LENGTHS.contains(barCode.length()) || !barCode.chars().allMatch(Character::isDigit)) {
            return false;
        }
        int sum = 0;
        int lastIndex = barCode.length() - 1;
        for (int i = lastIndex - 1; i >= 0; i--) {
            int digit = barCode.charAt(i) - '0';
            sum += (lastIndex - i) % 2 == 1 ? digit * 3 : digit;
        }
        int checkDigit = (10 - sum % 10) % 10;
        return checkDigit == barCode.charAt(lastIndex) - '0';
    }
}

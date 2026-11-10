package com.calendories.server.shoppinglist;

import com.calendories.server.TestcontainersConfiguration;
import com.calendories.server.user.User;
import com.calendories.server.user.UserRepository;
import com.calendories.server.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ShoppingListOrderIntegrationTest {

    @Autowired
    private ShoppingListRepository shoppingListRepository;

    @Autowired
    private UserRepository userRepository;

    private void saveItem(User user, String name, boolean checked) {
        ShoppingListItem item = new ShoppingListItem();
        item.setUser(user);
        item.setIngredientName(name);
        item.setIsChecked(checked);
        shoppingListRepository.save(item);
    }

    @Test
    void listsUncheckedItemsFirstAndNamesInPolishOrder() {
        User user = new User();
        user.setEmail("user-" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("hash");
        user.setRole(UserRole.USER);
        user = userRepository.save(user);
        saveItem(user, "Ananas", true);
        saveItem(user, "Żurek", false);
        saveItem(user, "Zupa", false);
        saveItem(user, "Śledź", false);
        saveItem(user, "sznycel", false);
        saveItem(user, "Jogurt 0%", false);
        saveItem(user, "Jogurt - truskawka", false);

        assertThat(shoppingListRepository.findByUserOrderByIsCheckedAscIngredientNameAsc(user))
                .extracting(ShoppingListItem::getIngredientName)
                .containsExactly("Jogurt - truskawka", "Jogurt 0%", "sznycel", "Śledź", "Zupa", "Żurek", "Ananas");
    }
}

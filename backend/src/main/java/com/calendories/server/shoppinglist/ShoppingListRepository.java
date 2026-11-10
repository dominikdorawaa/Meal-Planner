package com.calendories.server.shoppinglist;

import com.calendories.server.database.Collations;
import com.calendories.server.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ShoppingListRepository extends JpaRepository<ShoppingListItem, UUID> {
    @Query("select s from ShoppingListItem s where s.user = :user order by s.isChecked, collate(s.ingredientName as "
            + Collations.POLISH_NAMES + "), s.id")
    List<ShoppingListItem> findByUserOrderByIsCheckedAscIngredientNameAsc(User user);
    void deleteByUser(User user);
}

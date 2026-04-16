package com.example.demo.repository;

import com.example.demo.entity.ShoppingListItem;
import com.example.demo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ShoppingListRepository extends JpaRepository<ShoppingListItem, UUID> {
    List<ShoppingListItem> findByUserOrderByIsCheckedAscIngredientNameAsc(User user);
    void deleteByUser(User user);
}

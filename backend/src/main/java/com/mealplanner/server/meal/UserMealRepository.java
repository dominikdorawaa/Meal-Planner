package com.mealplanner.server.meal;

import com.mealplanner.server.product.Product;
import com.mealplanner.server.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface UserMealRepository extends JpaRepository<UserMeal, UUID> {
    List<UserMeal> findByUserAndMealDate(User user, LocalDate mealDate);
    List<UserMeal> findByUser(User user);
    boolean existsByProduct(Product product);
}

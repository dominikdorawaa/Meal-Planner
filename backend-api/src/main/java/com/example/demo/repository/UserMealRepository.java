package com.example.demo.repository;

import com.example.demo.entity.UserMeal;
import com.example.demo.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserMealRepository extends JpaRepository<UserMeal, UUID> {
    List<UserMeal> findByUserAndDateStr(User user, String dateStr);
    List<UserMeal> findByUser(User user);
    void deleteByProduct(com.example.demo.entity.Product product);
}

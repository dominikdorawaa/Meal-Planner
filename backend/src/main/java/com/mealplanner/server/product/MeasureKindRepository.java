package com.mealplanner.server.product;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MeasureKindRepository extends JpaRepository<MeasureKind, String> {

    List<MeasureKind> findAllByOrderBySortOrderAsc();
}

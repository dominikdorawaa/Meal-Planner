package com.calendories.server.product;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class GenericMeasureKinds {

    private final MeasureKindRepository measureKindRepository;

    @PostConstruct
    void load() {
        ProductMeasures.useGenericKinds(measureKindRepository.findByGenericBaseAmountIsNotNullOrderBySortOrderAsc());
    }
}

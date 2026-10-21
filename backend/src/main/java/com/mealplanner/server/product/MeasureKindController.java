package com.mealplanner.server.product;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/measure-kinds")
@CrossOrigin(origins = "${corsAllowedOrigins}")
@RequiredArgsConstructor
public class MeasureKindController {

    private final MeasureKindRepository measureKindRepository;

    @GetMapping
    public List<MeasureKind> list() {
        return measureKindRepository.findAllByOrderBySortOrderAsc();
    }
}

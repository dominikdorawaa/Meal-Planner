ALTER TABLE products DROP CONSTRAINT products_source_check;
UPDATE products SET source = 'OPEN_FOOD_FACTS' WHERE source = 'OFF';
ALTER TABLE products ADD CONSTRAINT products_source_check CHECK (source IN ('OPEN_FOOD_FACTS', 'USER'));

UPDATE products
SET kcal = round(kcal::numeric),
    protein = round(protein::numeric, 1),
    fat = round(fat::numeric, 1),
    carbs = round(carbs::numeric, 1);

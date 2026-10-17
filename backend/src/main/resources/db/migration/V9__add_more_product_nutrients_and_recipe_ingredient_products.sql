ALTER TABLE products
    ADD COLUMN saturated_fat double precision,
    ADD COLUMN sugars double precision,
    ADD COLUMN fiber double precision,
    ADD COLUMN salt double precision;

ALTER TABLE recipe_ingredients
    ADD COLUMN product_id uuid,
    ADD CONSTRAINT recipe_ingredients_product_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL;

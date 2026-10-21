CREATE TABLE measure_kinds (
    code varchar(20) NOT NULL,
    names jsonb NOT NULL,
    max_amount double precision NOT NULL,
    max_base_amount double precision NOT NULL,
    sort_order integer NOT NULL,
    CONSTRAINT measure_kinds_pkey PRIMARY KEY (code)
);

INSERT INTO measure_kinds (code, names, max_amount, max_base_amount, sort_order) VALUES
    ('piece', '{"pl": {"one": "sztuka", "few": "sztuki", "many": "sztuk", "other": "sztuki"}, "en": {"one": "piece", "other": "pieces"}}', 100, 5000, 1),
    ('slice', '{"pl": {"one": "plasterek", "few": "plasterki", "many": "plasterków", "other": "plasterka"}, "en": {"one": "slice", "other": "slices"}}', 100, 5000, 2),
    ('tbsp', '{"pl": {"one": "łyżka", "few": "łyżki", "many": "łyżek", "other": "łyżki"}, "en": {"one": "tablespoon", "other": "tablespoons"}}', 100, 5000, 3),
    ('tsp', '{"pl": {"one": "łyżeczka", "few": "łyżeczki", "many": "łyżeczek", "other": "łyżeczki"}, "en": {"one": "teaspoon", "other": "teaspoons"}}', 100, 5000, 4),
    ('cup', '{"pl": {"one": "szklanka", "few": "szklanki", "many": "szklanek", "other": "szklanki"}, "en": {"one": "cup", "other": "cups"}}', 50, 5000, 5),
    ('package', '{"pl": {"one": "opakowanie", "few": "opakowania", "many": "opakowań", "other": "opakowania"}, "en": {"one": "package", "other": "packages"}}', 100, 50000, 6);

CREATE TABLE product_measures (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    kind_code varchar(20) NOT NULL,
    base_amount double precision NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    position integer NOT NULL,
    CONSTRAINT product_measures_pkey PRIMARY KEY (id),
    CONSTRAINT product_measures_product_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT product_measures_kind_fkey FOREIGN KEY (kind_code) REFERENCES measure_kinds (code),
    CONSTRAINT product_measures_product_kind_key UNIQUE (product_id, kind_code),
    CONSTRAINT product_measures_base_amount_check CHECK (base_amount > 0)
);

INSERT INTO product_measures (id, product_id, kind_code, base_amount, is_default, position)
SELECT gen_random_uuid(), id, 'package', package_weight, false, 0
FROM products
WHERE package_weight IS NOT NULL AND package_weight > 0 AND (unit IS NULL OR unit <> 'pc');

ALTER TABLE products DROP COLUMN package_weight;

ALTER TABLE user_meals
    ADD COLUMN measure_code varchar(20),
    ADD COLUMN measure_amount double precision;

UPDATE recipe_ingredients SET unit = 'piece' WHERE unit = 'szt';
UPDATE recipe_ingredients SET unit = 'package' WHERE unit = 'opak';

INSERT INTO measure_kinds (code, names, max_amount, max_base_amount, sort_order) VALUES
    ('bread_slice', '{"pl": {"one": "kromka", "few": "kromki", "many": "kromek", "other": "kromki"}, "en": {"one": "slice of bread", "other": "slices of bread"}}', 100, 5000, 3),
    ('pinch', '{"pl": {"one": "szczypta", "few": "szczypty", "many": "szczypt", "other": "szczypty"}, "en": {"one": "pinch", "other": "pinches"}}', 100, 50, 6),
    ('mug', '{"pl": {"one": "kubek", "few": "kubki", "many": "kubków", "other": "kubka"}, "en": {"one": "mug", "other": "mugs"}}', 50, 5000, 8),
    ('serving', '{"pl": {"one": "porcja", "few": "porcje", "many": "porcji", "other": "porcji"}, "en": {"one": "serving", "other": "servings"}}', 100, 5000, 9),
    ('bar', '{"pl": {"one": "baton", "few": "batony", "many": "batonów", "other": "batona"}, "en": {"one": "bar", "other": "bars"}}', 100, 5000, 10);

UPDATE measure_kinds SET sort_order = 4 WHERE code = 'tbsp';
UPDATE measure_kinds SET sort_order = 5 WHERE code = 'tsp';
UPDATE measure_kinds SET sort_order = 7 WHERE code = 'cup';
UPDATE measure_kinds SET sort_order = 11 WHERE code = 'package';

UPDATE product_measures pm SET kind_code = 'bread_slice'
FROM products p
WHERE pm.product_id = p.id AND p.source = 'BASIC' AND p.name IN ('Chleb pszenny', 'Chleb żytni razowy')
  AND pm.kind_code = 'slice';

UPDATE user_meals um SET measure_code = 'bread_slice'
FROM products p
WHERE um.product_id = p.id AND p.source = 'BASIC' AND p.name IN ('Chleb pszenny', 'Chleb żytni razowy')
  AND um.measure_code = 'slice';

UPDATE recipe_ingredients ri SET unit = 'bread_slice'
FROM products p
WHERE ri.product_id = p.id AND p.source = 'BASIC' AND p.name IN ('Chleb pszenny', 'Chleb żytni razowy')
  AND ri.unit = 'slice';

INSERT INTO product_measures (id, product_id, kind_code, base_amount, is_default, position)
SELECT gen_random_uuid(), p.id, m.kind_code, m.base_amount, false, m.position
FROM (VALUES
    ('Sól', 'pinch', 0.5, 1),
    ('Sól', 'tbsp', 18, 2),
    ('Cukier', 'pinch', 0.5, 3),
    ('Kakao', 'pinch', 0.5, 2),
    ('Mąka pszenna', 'tsp', 3, 2),
    ('Mąka żytnia', 'tsp', 3, 2),
    ('Bułka tarta', 'tsp', 3, 1),
    ('Mleko 3,2%', 'mug', 300, 2),
    ('Mleko 2%', 'mug', 300, 2),
    ('Mleko 0,5%', 'mug', 300, 2),
    ('Kefir', 'mug', 300, 1),
    ('Maślanka', 'mug', 300, 1),
    ('Sok pomarańczowy', 'mug', 300, 1),
    ('Napój owsiany', 'mug', 300, 2)
) AS m (name, kind_code, base_amount, position)
JOIN products p ON p.name = m.name AND p.source = 'BASIC'
ON CONFLICT (product_id, kind_code) DO NOTHING;

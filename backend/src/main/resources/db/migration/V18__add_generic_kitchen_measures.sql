ALTER TABLE measure_kinds ADD COLUMN generic_base_amount double precision;

UPDATE measure_kinds SET generic_base_amount = 15 WHERE code = 'tbsp';
UPDATE measure_kinds SET generic_base_amount = 5 WHERE code = 'tsp';
UPDATE measure_kinds SET generic_base_amount = 250 WHERE code = 'cup';
UPDATE measure_kinds SET generic_base_amount = 0.5 WHERE code = 'pinch';

ALTER TABLE measure_kinds
    ADD COLUMN generic_base_amount double precision,
    ADD COLUMN generic_by_default boolean NOT NULL DEFAULT false;

UPDATE measure_kinds SET generic_base_amount = 15, generic_by_default = true WHERE code = 'tbsp';
UPDATE measure_kinds SET generic_base_amount = 5, generic_by_default = true WHERE code = 'tsp';
UPDATE measure_kinds SET generic_base_amount = 250, generic_by_default = true WHERE code = 'cup';
UPDATE measure_kinds SET generic_base_amount = 0.5 WHERE code = 'pinch';

ALTER TABLE products ADD COLUMN kitchen_measures varchar(20)[];

UPDATE products SET kitchen_measures = '{}' WHERE source = 'BASIC';

UPDATE products p SET kitchen_measures = m.codes::varchar(20)[]
FROM (VALUES
    ('Sól', '{tbsp,tsp,pinch}'),
    ('Kakao', '{tbsp,tsp,pinch}'),
    ('Cukier', '{tbsp,tsp,pinch,cup}'),
    ('Mąka pszenna', '{tbsp,tsp,cup}'),
    ('Mąka żytnia', '{tbsp,tsp,cup}'),
    ('Ryż biały', '{tbsp,tsp,cup}'),
    ('Ryż brązowy', '{tbsp,tsp,cup}'),
    ('Kasza gryczana', '{tbsp,tsp,cup}'),
    ('Kasza jaglana', '{tbsp,tsp,cup}'),
    ('Kasza bulgur', '{tbsp,tsp,cup}'),
    ('Kuskus', '{tbsp,tsp,cup}'),
    ('Płatki owsiane', '{tbsp,tsp,cup}'),
    ('Bułka tarta', '{tbsp,tsp,cup}'),
    ('Nasiona chia', '{tbsp,tsp,cup}'),
    ('Siemię lniane', '{tbsp,tsp,cup}'),
    ('Pestki dyni', '{tbsp,tsp,cup}'),
    ('Słonecznik', '{tbsp,tsp,cup}'),
    ('Orzechy włoskie', '{tbsp,tsp,cup}'),
    ('Migdały', '{tbsp,tsp,cup}'),
    ('Orzechy laskowe', '{tbsp,tsp,cup}'),
    ('Orzeszki ziemne', '{tbsp,tsp,cup}'),
    ('Rodzynki', '{tbsp,tsp,cup}'),
    ('Żurawina suszona', '{tbsp,tsp,cup}'),
    ('Mleko 3,2%', '{tbsp,tsp,cup}'),
    ('Mleko 2%', '{tbsp,tsp,cup}'),
    ('Mleko 0,5%', '{tbsp,tsp,cup}'),
    ('Kefir', '{tbsp,tsp,cup}'),
    ('Maślanka', '{tbsp,tsp,cup}'),
    ('Sok pomarańczowy', '{tbsp,tsp,cup}'),
    ('Napój owsiany', '{tbsp,tsp,cup}'),
    ('Oliwa z oliwek', '{tbsp,tsp,cup}'),
    ('Olej rzepakowy', '{tbsp,tsp,cup}'),
    ('Sos sojowy', '{tbsp,tsp,cup}'),
    ('Jogurt naturalny', '{tbsp,tsp,cup}'),
    ('Jogurt grecki', '{tbsp,tsp,cup}'),
    ('Śmietana 18%', '{tbsp,tsp,cup}'),
    ('Twaróg półtłusty', '{tbsp,tsp,cup}'),
    ('Serek wiejski', '{tbsp,tsp,cup}'),
    ('Hummus', '{tbsp,tsp,cup}'),
    ('Passata pomidorowa', '{tbsp,tsp,cup}'),
    ('Masło', '{tbsp,tsp}'),
    ('Miód', '{tbsp,tsp}'),
    ('Musztarda', '{tbsp,tsp}'),
    ('Koncentrat pomidorowy', '{tbsp,tsp}'),
    ('Masło orzechowe', '{tbsp,tsp}'),
    ('Borówki amerykańskie', '{tbsp,cup}'),
    ('Maliny', '{tbsp,cup}'),
    ('Groszek zielony', '{tbsp,cup}'),
    ('Kukurydza konserwowa', '{tbsp,cup}'),
    ('Ciecierzyca konserwowa', '{tbsp,cup}'),
    ('Fasola czerwona konserwowa', '{tbsp,cup}'),
    ('Soczewica czerwona', '{tbsp,cup}'),
    ('Pomidory krojone z puszki', '{tbsp,cup}'),
    ('Parmezan', '{tbsp,cup}')
) AS m (name, codes)
WHERE p.name = m.name AND p.source = 'BASIC';

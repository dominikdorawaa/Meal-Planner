UPDATE recipes SET is_archived = false WHERE is_archived IS NULL;
ALTER TABLE recipes ALTER COLUMN is_archived SET DEFAULT false;
ALTER TABLE recipes ALTER COLUMN is_archived SET NOT NULL;

ALTER TABLE recipes ADD COLUMN visibility varchar(20) NOT NULL DEFAULT 'PRIVATE';
UPDATE recipes SET visibility = 'PUBLIC' WHERE created_by IS NULL;
ALTER TABLE recipes ADD CONSTRAINT recipes_visibility_check CHECK (visibility IN ('PRIVATE', 'PUBLIC'));

ALTER TABLE recipes ALTER COLUMN image_url TYPE varchar(1024);

UPDATE recipes r
SET kcal = round((r.kcal / r.portions)::numeric, 0),
    protein = round((r.protein / r.portions)::numeric, 1),
    fat = round((r.fat / r.portions)::numeric, 1),
    carbs = round((r.carbs / r.portions)::numeric, 1)
WHERE r.created_by IS NOT NULL
  AND r.portions > 1
  AND EXISTS (SELECT 1 FROM recipe_ingredients i WHERE i.recipe_id = r.id AND i.product_id IS NOT NULL);

CREATE INDEX recipes_created_by_idx ON recipes (created_by);

CREATE TABLE saved_recipes (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    created_at timestamp(6) with time zone,
    CONSTRAINT saved_recipes_pkey PRIMARY KEY (id),
    CONSTRAINT saved_recipes_user_recipe_key UNIQUE (user_id, recipe_id),
    CONSTRAINT saved_recipes_user_fkey FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE,
    CONSTRAINT saved_recipes_recipe_fkey FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
);

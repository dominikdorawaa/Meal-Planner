CREATE TABLE recipe_images (
    recipe_id uuid NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
    position integer NOT NULL,
    url varchar(1024) NOT NULL,
    focus_x double precision NOT NULL DEFAULT 50,
    focus_y double precision NOT NULL DEFAULT 50,
    CONSTRAINT recipe_images_pkey PRIMARY KEY (recipe_id, position)
);

INSERT INTO recipe_images (recipe_id, position, url)
SELECT id, 0, btrim(image_url)
FROM recipes
WHERE image_url IS NOT NULL AND btrim(image_url) <> '';

ALTER TABLE recipes DROP COLUMN image_url;

CREATE TABLE app_users (
    id uuid NOT NULL,
    email varchar(255) NOT NULL,
    name varchar(255),
    password_hash varchar(255) NOT NULL,
    created_at timestamp(6) with time zone,
    CONSTRAINT app_users_pkey PRIMARY KEY (id),
    CONSTRAINT app_users_email_key UNIQUE (email)
);

CREATE TABLE user_profiles (
    id uuid NOT NULL,
    display_name varchar(255),
    gender varchar(255),
    age integer,
    weight double precision,
    height double precision,
    target_weight double precision,
    lifestyle_activity double precision,
    exercise_activity double precision,
    activity varchar(255),
    goal varchar(255),
    change_speed double precision,
    is_manual_macros boolean,
    target_kcal integer,
    target_protein integer,
    target_fat integer,
    target_carbs integer,
    target_protein_min integer,
    target_protein_max integer,
    target_fat_min integer,
    target_fat_max integer,
    target_carbs_min integer,
    target_carbs_max integer,
    meal_config jsonb,
    visible_meals jsonb,
    CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
    CONSTRAINT user_profiles_user_fkey FOREIGN KEY (id) REFERENCES app_users (id)
);

CREATE TABLE products (
    id uuid NOT NULL,
    name varchar(255) NOT NULL,
    brand varchar(255),
    bar_code varchar(255),
    unit varchar(255),
    kcal double precision,
    protein double precision,
    fat double precision,
    carbs double precision,
    created_at timestamp(6) with time zone,
    CONSTRAINT products_pkey PRIMARY KEY (id),
    CONSTRAINT products_bar_code_key UNIQUE (bar_code)
);

CREATE TABLE recipes (
    id uuid NOT NULL,
    name varchar(255) NOT NULL,
    image_url varchar(255),
    kcal double precision,
    protein double precision,
    fat double precision,
    carbs double precision,
    prep_time integer,
    portions double precision,
    instructions jsonb,
    is_archived boolean,
    created_by uuid,
    created_at timestamp(6) with time zone,
    CONSTRAINT recipes_pkey PRIMARY KEY (id)
);

CREATE TABLE recipe_ingredients (
    id uuid NOT NULL,
    recipe_id uuid,
    name varchar(255) NOT NULL,
    amount double precision NOT NULL,
    unit varchar(255) NOT NULL,
    CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id),
    CONSTRAINT recipe_ingredients_recipe_fkey FOREIGN KEY (recipe_id) REFERENCES recipes (id)
);

CREATE TABLE user_meals (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    recipe_id uuid,
    product_id uuid,
    date_str varchar(255) NOT NULL,
    meal_type varchar(255) NOT NULL,
    portions_consumed double precision,
    manual_name varchar(255),
    manual_kcal double precision,
    manual_protein double precision,
    manual_fat double precision,
    manual_carbs double precision,
    created_at timestamp(6) with time zone,
    CONSTRAINT user_meals_pkey PRIMARY KEY (id),
    CONSTRAINT user_meals_user_fkey FOREIGN KEY (user_id) REFERENCES app_users (id),
    CONSTRAINT user_meals_recipe_fkey FOREIGN KEY (recipe_id) REFERENCES recipes (id),
    CONSTRAINT user_meals_product_fkey FOREIGN KEY (product_id) REFERENCES products (id)
);

CREATE TABLE shopping_list (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    recipe_id uuid,
    ingredient_name varchar(255) NOT NULL,
    quantity double precision,
    unit varchar(255),
    category varchar(255),
    is_checked boolean,
    created_at timestamp(6) with time zone,
    CONSTRAINT shopping_list_pkey PRIMARY KEY (id),
    CONSTRAINT shopping_list_user_fkey FOREIGN KEY (user_id) REFERENCES app_users (id),
    CONSTRAINT shopping_list_recipe_fkey FOREIGN KEY (recipe_id) REFERENCES recipes (id)
);

CREATE TABLE shopping_list_recipes (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    portions double precision,
    created_at timestamp(6) with time zone,
    CONSTRAINT shopping_list_recipes_pkey PRIMARY KEY (id),
    CONSTRAINT shopping_list_recipes_user_fkey FOREIGN KEY (user_id) REFERENCES app_users (id),
    CONSTRAINT shopping_list_recipes_recipe_fkey FOREIGN KEY (recipe_id) REFERENCES recipes (id)
);

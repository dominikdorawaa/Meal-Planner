ALTER TABLE user_meals ADD COLUMN meal_date date;

WITH parsed AS MATERIALIZED (
    SELECT id,
           CASE WHEN date_str ~ '^\d{1,2}\.\d{1,2}$' THEN split_part(date_str, '.', 1)::int END AS day_of_month,
           CASE WHEN date_str ~ '^\d{1,2}\.\d{1,2}$' THEN split_part(date_str, '.', 2)::int END AS month_of_year,
           coalesce(created_at, now()) AT TIME ZONE 'Europe/Warsaw' AS reference_time
    FROM user_meals
),
valid AS MATERIALIZED (
    SELECT id, day_of_month, month_of_year, reference_time::date AS reference_date
    FROM parsed
    WHERE month_of_year BETWEEN 1 AND 12 AND day_of_month BETWEEN 1 AND 31
),
resolved AS (
    SELECT DISTINCT ON (v.id) v.id, c.candidate
    FROM valid v
    CROSS JOIN LATERAL (
        SELECT make_date(y, v.month_of_year, 1) + (v.day_of_month - 1) AS candidate
        FROM generate_series(extract(year FROM v.reference_date)::int - 4,
                             extract(year FROM v.reference_date)::int + 4) AS y
    ) c
    WHERE extract(month FROM c.candidate) = v.month_of_year
    ORDER BY v.id, abs(c.candidate - v.reference_date), c.candidate DESC
)
UPDATE user_meals um
SET meal_date = resolved.candidate
FROM resolved
WHERE um.id = resolved.id;

UPDATE user_meals
SET meal_date = (coalesce(created_at, now()) AT TIME ZONE 'Europe/Warsaw')::date
WHERE meal_date IS NULL;

ALTER TABLE user_meals ALTER COLUMN meal_date SET NOT NULL;
ALTER TABLE user_meals DROP COLUMN date_str;

CREATE INDEX user_meals_user_date_idx ON user_meals (user_id, meal_date);

UPDATE recipes
SET instructions = (
    SELECT COALESCE(
        jsonb_agg(
            CASE
                WHEN jsonb_typeof(step) = 'string' THEN jsonb_build_object('name', NULL, 'text', step #>> '{}')
                ELSE step
            END
            ORDER BY position
        ),
        '[]'::jsonb
    )
    FROM jsonb_array_elements(instructions) WITH ORDINALITY AS steps(step, position)
)
WHERE jsonb_typeof(instructions) = 'array';

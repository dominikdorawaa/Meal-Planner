\pset pager off
\pset footer off
\t on
\a

SELECT format(
    'SELECT %L || '' rows '' || count(*) FROM %I.%I;',
    'table ' || table_name,
    table_schema,
    table_name
)
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name COLLATE "C"
\gexec

SELECT 'sequence ' || sequencename || ' last_value ' || coalesce(last_value::text, 'unused')
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename COLLATE "C";

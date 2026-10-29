
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND (
    table_name ILIKE '%client%'
    OR table_name ILIKE '%customer%'
    OR table_name ILIKE '%contact%'
  )
ORDER BY table_name;

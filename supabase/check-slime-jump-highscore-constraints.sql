-- READ-ONLY: Zeigt die relevanten CHECK-Constraints der Highscore-Tabelle.
-- Diese Abfrage verändert weder Schema noch Daten.

select
  constraint_info.conname as constraint_name,
  pg_get_constraintdef(constraint_info.oid, true) as constraint_definition,
  constraint_info.convalidated as is_validated
from pg_constraint as constraint_info
join pg_class as table_info
  on table_info.oid = constraint_info.conrelid
join pg_namespace as schema_info
  on schema_info.oid = table_info.relnamespace
where schema_info.nspname = 'public'
  and table_info.relname = 'slime_jump_highscores'
  and constraint_info.contype = 'c'
  and (
    pg_get_constraintdef(constraint_info.oid, true) ilike '%slime_color%'
    or pg_get_constraintdef(constraint_info.oid, true) ilike '%slime_cosmetic%'
    or pg_get_constraintdef(constraint_info.oid, true) ilike '%slime_beard%'
  )
order by constraint_info.conname;

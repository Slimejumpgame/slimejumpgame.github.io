-- READ-ONLY: Prueft die relevanten Appearance-/Achievement-Spalten und
-- CHECK-Constraints von public.slime_jump_highscores.
-- Diese Abfragen veraendern weder Schema noch Daten.

with requested_columns (column_name, display_order) as (
  values
    ('slime_color', 1),
    ('slime_cosmetic', 2),
    ('slime_beard', 3),
    ('slime_achievements', 4)
)
select
  requested.column_name,
  (columns_info.column_name is not null) as column_exists,
  columns_info.data_type,
  columns_info.udt_name as postgres_type,
  columns_info.column_default,
  columns_info.is_nullable
from requested_columns as requested
left join information_schema.columns as columns_info
  on columns_info.table_schema = 'public'
  and columns_info.table_name = 'slime_jump_highscores'
  and columns_info.column_name = requested.column_name
order by requested.display_order;

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
    or pg_get_constraintdef(constraint_info.oid, true) ilike '%slime_achievements%'
  )
order by constraint_info.conname;

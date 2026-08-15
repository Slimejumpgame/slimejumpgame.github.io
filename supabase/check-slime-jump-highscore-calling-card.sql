-- READ-ONLY: Prueft die optionale Calling-Card-Snapshot-Spalte und ihre
-- CHECK-Constraints. Diese Abfrage veraendert weder Schema noch Daten.

select
  columns_info.column_name,
  columns_info.data_type,
  columns_info.is_nullable,
  columns_info.column_default
from information_schema.columns as columns_info
where columns_info.table_schema = 'public'
  and columns_info.table_name = 'slime_jump_highscores'
  and columns_info.column_name = 'calling_card_snapshot';

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
  and pg_get_constraintdef(constraint_info.oid, true)
    ilike '%calling_card_snapshot%'
order by constraint_info.conname;

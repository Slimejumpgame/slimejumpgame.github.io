-- NICHT AUSFÜHREN: KONTROLLIERTER MIGRATIONSENTWURF
--
-- 1. Zuerst check-slime-jump-highscore-constraints.sql ausführen.
-- 2. Die drei Platzhalter unten anhand der tatsächlichen Ausgabe ersetzen.
-- 3. Falls für eine Spalte keine alte Constraint existiert, die zugehörige
--    DROP-CONSTRAINT-Zeile nach Kontrolle entfernen.
-- 4. Erst nach gemeinsamer Prüfung den Safety-Guard entfernen.
--
-- NOT VALID sorgt dafür, dass unbekannte historische Werte bestehender Zeilen
-- nicht gelöscht oder beim Anlegen der neuen Constraints abgelehnt werden.
-- Neue oder geänderte Zeilen müssen die neuen Whitelists dennoch erfüllen.

begin;

-- SAFETY-GUARD: Dieser Entwurf bricht absichtlich ab.
do $migration_guard$
begin
  raise exception
    'DRAFT NICHT AUSFÜHREN: Erst Constraint-Namen prüfen, Platzhalter ersetzen und Guard entfernen.';
end
$migration_guard$;

alter table public.slime_jump_highscores
  add column if not exists slime_beard text;

update public.slime_jump_highscores
set slime_beard = 'none'
where slime_beard is null;

alter table public.slime_jump_highscores
  alter column slime_beard set default 'none',
  alter column slime_beard set not null;

-- Platzhalter zwingend durch die read-only ermittelten Namen ersetzen.
alter table public.slime_jump_highscores
  drop constraint "__SLIME_COLOR_CONSTRAINT_NAME__";

alter table public.slime_jump_highscores
  drop constraint "__SLIME_COSMETIC_CONSTRAINT_NAME__";

alter table public.slime_jump_highscores
  drop constraint "__SLIME_BEARD_CONSTRAINT_NAME__";

alter table public.slime_jump_highscores
  add constraint slime_jump_highscores_slime_color_check
  check (
    slime_color is null
    or slime_color in (
      'purple',
      'blue',
      'cyan',
      'green',
      'yellow',
      'orange',
      'red',
      'pink',
      'crimson',
      'burgundy',
      'apricot',
      'gold',
      'lime',
      'forest',
      'mint',
      'teal',
      'ice_blue',
      'navy',
      'indigo',
      'magenta',
      'hot_pink',
      'vanilla',
      'silver',
      'charcoal'
    )
  ) not valid;

alter table public.slime_jump_highscores
  add constraint slime_jump_highscores_slime_cosmetic_check
  check (
    slime_cosmetic is null
    or slime_cosmetic in (
      'none',
      'sunglasses',
      'cap',
      'crown',
      'top_hat',
      'wizard_hat',
      'pirate_hat',
      'headphones',
      'bow',
      'cowboy_hat',
      'devil_horns',
      'halo',
      'ninja_headband',
      'viking_helmet',
      'party_hat',
      'chef_hat',
      'propeller_hat',
      'cat_ears',
      'bunny_ears'
    )
  ) not valid;

alter table public.slime_jump_highscores
  add constraint slime_jump_highscores_slime_beard_check
  check (
    slime_beard in (
      'none',
      'stubble',
      'mustache',
      'goatee',
      'full_beard',
      'cowboy_mustache',
      'viking_beard',
      'wizard_beard',
      'braided_beard',
      'lumberjack_beard',
      'imperial_beard'
    )
  ) not valid;

commit;

-- Nach erfolgreich kontrollierter Migration in js/slime-jump-highscores.js:
-- SLIME_BEARD_COLUMN_ENABLED von false auf true setzen.

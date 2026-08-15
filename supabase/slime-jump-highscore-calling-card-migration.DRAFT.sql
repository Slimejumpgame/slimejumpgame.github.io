-- NICHT AUSFUEHREN: KONTROLLIERTER, ADDITIVER MIGRATIONSENTWURF
--
-- 1. Zuerst check-slime-jump-highscore-calling-card.sql ausfuehren.
-- 2. Ausgabe und Tabellenzustand gemeinsam pruefen.
-- 3. Erst nach ausdruecklicher Freigabe den Safety-Guard entfernen.
--
-- Die nullable JSONB-Spalte laesst alle bestehenden Highscores unveraendert.
-- Es gibt bewusst kein UPDATE, DELETE, DROP, TRUNCATE oder Tabellen-Recreate.

begin;

-- SAFETY-GUARD: Dieser Entwurf bricht absichtlich vor jeder Aenderung ab.
do $migration_guard$
begin
  raise exception
    'DRAFT NICHT AUSFUEHREN: Erst Read-only-Pruefung auswerten und Migration freigeben.';
end
$migration_guard$;

alter table public.slime_jump_highscores
  add column if not exists calling_card_snapshot jsonb;

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'slime_jump_highscores_calling_card_snapshot_check'
      and conrelid = 'public.slime_jump_highscores'::regclass
  ) then
    alter table public.slime_jump_highscores
      add constraint slime_jump_highscores_calling_card_snapshot_check
      check (
        calling_card_snapshot is null
        or (
          jsonb_typeof(calling_card_snapshot) = 'object'
          and calling_card_snapshot ?& array[
            'formatVersion',
            'playerLevel',
            'prestigeLevel',
            'prestigeEmblemId',
            'prestigeFrame',
            'prestigeTitle',
            'prestigeAura',
            'prestigeTrail',
            'slimeAchievements'
          ]
          and calling_card_snapshot ->> 'formatVersion' = '1'
          and jsonb_typeof(calling_card_snapshot -> 'playerLevel') = 'number'
          and jsonb_typeof(calling_card_snapshot -> 'prestigeLevel') = 'number'
          and jsonb_typeof(calling_card_snapshot -> 'prestigeEmblemId') = 'string'
          and jsonb_typeof(calling_card_snapshot -> 'prestigeFrame') = 'string'
          and jsonb_typeof(calling_card_snapshot -> 'prestigeTitle') = 'string'
          and jsonb_typeof(calling_card_snapshot -> 'prestigeAura') = 'string'
          and jsonb_typeof(calling_card_snapshot -> 'prestigeTrail') = 'string'
          and jsonb_typeof(calling_card_snapshot -> 'slimeAchievements') = 'array'
          and jsonb_array_length(calling_card_snapshot -> 'slimeAchievements') <= 5
        )
      ) not valid;
  end if;
end
$constraint$;

alter table public.slime_jump_highscores
  validate constraint slime_jump_highscores_calling_card_snapshot_check;

commit;

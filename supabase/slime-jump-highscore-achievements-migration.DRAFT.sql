-- NICHT AUSFUEHREN: KONTROLLIERTER MIGRATIONSENTWURF
--
-- 1. Zuerst check-slime-jump-highscore-achievements.sql ausfuehren.
-- 2. Ausgabe und Tabellenzustand gemeinsam pruefen.
-- 3. Erst nach ausdruecklicher Freigabe den Safety-Guard entfernen.
--
-- text[] passt direkt zu JavaScript-Arrays in PostgREST. Der leere Default
-- haelt bestehende Highscores kompatibel; gespeichert werden nur IDs.

begin;

-- SAFETY-GUARD: Dieser Entwurf bricht absichtlich vor jeder Aenderung ab.
do $migration_guard$
begin
  raise exception
    'DRAFT NICHT AUSFUEHREN: Erst Read-only-Pruefung auswerten und Migration freigeben.';
end
$migration_guard$;

alter table public.slime_jump_highscores
  add column if not exists slime_achievements text[]
  not null
  default '{}'::text[];

-- Keine feste Achievement-ID-Liste: Neue Registry-Eintraege bleiben moeglich.
-- Die App validiert IDs gegen ihre zentrale Achievement-Registry.
alter table public.slime_jump_highscores
  add constraint slime_jump_highscores_slime_achievements_check
  check (
    array_position(slime_achievements, null) is null
  );

commit;

-- Erst nach erfolgreich kontrollierter Migration in js/slime-jump-highscores.js:
-- SLIME_ACHIEVEMENTS_COLUMN_ENABLED von false auf true setzen.

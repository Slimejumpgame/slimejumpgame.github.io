-- DESTRUKTIVER, EINMALIGER FRESH-START.
-- NICHT automatisch ausfuehren. Erst Backups und v2-Migration gemeinsam pruefen.
-- Diese Datei leert ausschliesslich die beiden freigegebenen Live-Tabellen.

begin;

lock table public.slime_jump_highscores in access exclusive mode;
lock table public.slime_jump_player_bests in access exclusive mode;

do $reset_guard$
declare
  live_highscore_count bigint;
  backup_highscore_count bigint;
  live_player_best_count bigint;
  backup_player_best_count bigint;
begin
  if to_regclass('public.slime_jump_highscores_backup_20260821') is null then
    raise exception 'Highscore-Backup public.slime_jump_highscores_backup_20260821 fehlt';
  end if;

  if to_regclass('public.slime_jump_player_bests_backup_20260821') is null then
    raise exception 'Player-Bests-Backup public.slime_jump_player_bests_backup_20260821 fehlt';
  end if;

  select count(*) into live_highscore_count
  from public.slime_jump_highscores;
  select count(*) into backup_highscore_count
  from public.slime_jump_highscores_backup_20260821;
  select count(*) into live_player_best_count
  from public.slime_jump_player_bests;
  select count(*) into backup_player_best_count
  from public.slime_jump_player_bests_backup_20260821;

  if live_highscore_count <> backup_highscore_count then
    raise exception
      'Highscore-Backup ist nicht aktuell: Live %, Backup %',
      live_highscore_count,
      backup_highscore_count;
  end if;

  if live_player_best_count <> backup_player_best_count then
    raise exception
      'Player-Bests-Backup ist nicht aktuell: Live %, Backup %',
      live_player_best_count,
      backup_player_best_count;
  end if;
end;
$reset_guard$;

truncate table
  public.slime_jump_highscores,
  public.slime_jump_player_bests;

-- Nach dem leeren Fresh Start sind Legacy-Zeilen ohne Installation-ID verboten.
alter table public.slime_jump_highscores
  alter column player_id set not null;

commit;

-- Die Backup-Tabellen werden in dieser Datei ausschliesslich gelesen und niemals
-- geloescht, geleert oder veraendert.
